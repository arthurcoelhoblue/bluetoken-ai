/**
 * sync-renewal-triggers
 *
 * Busca clientes CS próximos da renovação (via cs_contracts ou sgt_client_status)
 * e cria deals de renovação automaticamente no pipeline correto.
 *
 * Pode ser chamado via cron ou manualmente.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { assertEmpresa } from "../_shared/tenant.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("sync-renewal-triggers");

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { empresa = "BLUE" } = await req.json().catch(() => ({}));
    assertEmpresa(empresa);

    const supabase = createServiceClient();
    const results: Array<Record<string, unknown>> = [];

    // ── Path 1: SGT client status table ──
    const { data: sgtClients, error: sgtError } = await supabase
      .from("sgt_client_status")
      .select("*")
      .eq("empresa", empresa)
      .in("status_declaracao", ["FINALIZADA", "EM_ANDAMENTO"])
      .is("renewal_deal_created", null);

    if (!sgtError && sgtClients && sgtClients.length > 0) {
      log.info("Processando clientes SGT", { count: sgtClients.length, empresa });

      for (const client of sgtClients) {
        try {
          // Find matching contact
          let contactId: string | null = null;
          if (client.email || client.telefone) {
            const orFilters = [];
            if (client.email) orFilters.push(`email.eq.${client.email}`);
            if (client.telefone) orFilters.push(`telefone.eq.${client.telefone}`);

            const { data: contact } = await supabase
              .from("contacts")
              .select("id")
              .eq("empresa", empresa)
              .or(orFilters.join(","))
              .limit(1)
              .maybeSingle();

            contactId = contact?.id || null;
          }

          if (!contactId) {
            results.push({ nome: client.nome, status: "SEM_CONTATO" });
            continue;
          }

          // Find pipeline + first stage
          const { data: pipeline } = await supabase
            .from("pipelines")
            .select("id, stages:pipeline_stages(id, nome, ordem)")
            .eq("empresa", empresa)
            .eq("is_active", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

          if (!pipeline) {
            results.push({ nome: client.nome, status: "SEM_PIPELINE" });
            continue;
          }

          const firstStage = (pipeline.stages as any[])
            ?.sort((a: any, b: any) => a.ordem - b.ordem)[0];

          if (!firstStage) {
            results.push({ nome: client.nome, status: "SEM_STAGE" });
            continue;
          }

          // Check for existing renewal deal
          const { data: existingDeal } = await supabase
            .from("deals")
            .select("id")
            .eq("contact_id", contactId)
            .eq("pipeline_id", pipeline.id)
            .eq("status", "ABERTO")
            .ilike("titulo", "%Renovação%")
            .limit(1)
            .maybeSingle();

          if (existingDeal) {
            results.push({ nome: client.nome, status: "DEAL_JA_EXISTE" });
            continue;
          }

          // Find vendedor by name
          let ownerId: string | null = null;
          if (client.vendedor_responsavel) {
            const { data: vendedor } = await supabase
              .from("profiles")
              .select("id")
              .ilike("full_name", `%${client.vendedor_responsavel}%`)
              .limit(1)
              .maybeSingle();
            ownerId = vendedor?.id || null;
          }

          // Create renewal deal with REAL schema columns
          const { data: newDeal, error: dealError } = await supabase
            .from("deals")
            .insert({
              contact_id: contactId,
              pipeline_id: pipeline.id,
              stage_id: firstStage.id,
              titulo: `Renovação SGT - ${client.nome}`,
              valor: 0,
              moeda: "BRL",
              owner_id: ownerId,
              posicao_kanban: 0,
              status: "ABERTO",
              temperatura: "MORNO",
              origem: "SGT_RENOVACAO",
              notas: `Deal de renovação criado via SGT.\nStatus declaração: ${client.status_declaracao}\nPlano atual: ${client.plano_atual || "N/A"}`,
              metadata: {
                tipo: "RENOVACAO",
                sgt_status: client.status_declaracao,
                plano_atual: client.plano_atual,
              },
            })
            .select("id")
            .single();

          if (dealError) {
            log.error("Erro ao criar deal SGT", { error: dealError.message, nome: client.nome });
            results.push({ nome: client.nome, status: "ERRO_CRIAR_DEAL", error: dealError.message });
            continue;
          }

          // Mark as processed
          await supabase
            .from("sgt_client_status")
            .update({ renewal_deal_created: newDeal.id, processed_at: new Date().toISOString() })
            .eq("id", client.id);

          // Notify vendedor
          if (ownerId) {
            await supabase.from("notifications").insert({
              user_id: ownerId,
              empresa,
              tipo: "RENOVACAO",
              titulo: `Renovação SGT: ${client.nome}`,
              mensagem: `${client.nome} está finalizando a declaração no SGT. Bom timing para renovação!`,
              metadata: { deal_id: newDeal.id },
            });
          }

          results.push({ nome: client.nome, status: "DEAL_CRIADO", deal_id: newDeal.id });
        } catch (err) {
          log.error("Erro processando cliente SGT", { error: String(err), nome: client.nome });
          results.push({ nome: client.nome, status: "ERRO", error: String(err) });
        }
      }

      return json({
        success: true,
        source: "sgt_client_status",
        message: `Processados ${results.length} clientes do SGT.`,
        processed: results.length,
        results,
      });
    }

    // ── Path 2: Fallback — cs_contracts próximos do vencimento ──
    log.info("SGT vazio ou indisponível, usando cs_contracts como fallback", { empresa });

    const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const { data: contracts } = await supabase
      .from("cs_contracts")
      .select(`
        id, customer_id, plano, valor, data_vencimento,
        customer:cs_customers!inner(id, contact_id, csm_id, empresa, is_active)
      `)
      .eq("status", "ATIVO")
      .lte("data_vencimento", sixtyDaysFromNow)
      .gte("data_vencimento", today);

    // Filter by empresa (cs_contracts.empresa matches)
    const tenantContracts = (contracts || []).filter(
      (c: any) => c.customer?.empresa === empresa && c.customer?.is_active
    );

    if (tenantContracts.length === 0) {
      return json({
        success: true,
        source: "cs_contracts",
        message: "Nenhum cliente em timing de renovação encontrado.",
        processed: 0,
      });
    }

    for (const contract of tenantContracts) {
      const customer = contract.customer as any;
      try {
        // Check existing renewal deal
        const { data: existingDeal } = await supabase
          .from("deals")
          .select("id")
          .eq("contact_id", customer.contact_id)
          .eq("status", "ABERTO")
          .ilike("titulo", "%Renovação%")
          .limit(1)
          .maybeSingle();

        if (existingDeal) {
          results.push({ contract_id: contract.id, status: "DEAL_JA_EXISTE" });
          continue;
        }

        // Get contact name
        const { data: contact } = await supabase
          .from("contacts")
          .select("nome")
          .eq("id", customer.contact_id)
          .single();

        const contactNome = contact?.nome || "Cliente";

        // Find pipeline
        const { data: pipeline } = await supabase
          .from("pipelines")
          .select("id, stages:pipeline_stages(id, nome, ordem)")
          .eq("empresa", empresa)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (!pipeline) {
          results.push({ nome: contactNome, status: "SEM_PIPELINE" });
          continue;
        }

        const firstStage = (pipeline.stages as any[])
          ?.sort((a: any, b: any) => a.ordem - b.ordem)[0];

        if (!firstStage) {
          results.push({ nome: contactNome, status: "SEM_STAGE" });
          continue;
        }

        const diasRestantes = Math.ceil(
          (new Date(contract.data_vencimento).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        // Create deal with REAL schema
        const { data: newDeal, error: dealError } = await supabase
          .from("deals")
          .insert({
            contact_id: customer.contact_id,
            pipeline_id: pipeline.id,
            stage_id: firstStage.id,
            titulo: `Renovação - ${contactNome}`,
            valor: contract.valor || 0,
            moeda: "BRL",
            owner_id: customer.csm_id,
            posicao_kanban: 0,
            status: "ABERTO",
            temperatura: "MORNO",
            origem: "RENOVACAO_AUTOMATICA",
            notas: `Deal de renovação criado automaticamente.\nPlano: ${contract.plano || "N/A"}\nVencimento: ${contract.data_vencimento}\nDias restantes: ${diasRestantes}`,
            metadata: {
              tipo: "RENOVACAO",
              cs_customer_id: customer.id,
              contract_id: contract.id,
              plano_atual: contract.plano,
              data_vencimento: contract.data_vencimento,
              dias_restantes: diasRestantes,
            },
          })
          .select("id")
          .single();

        if (dealError) {
          log.error("Erro ao criar deal renovação", { error: dealError.message, nome: contactNome });
          results.push({ nome: contactNome, status: "ERRO_CRIAR_DEAL", error: dealError.message });
          continue;
        }

        // Notify CSM
        if (customer.csm_id) {
          await supabase.from("notifications").insert({
            user_id: customer.csm_id,
            empresa,
            tipo: "RENOVACAO",
            titulo: `Renovação: ${contactNome}`,
            mensagem: `O contrato de ${contactNome} vence em ${diasRestantes} dias. Deal de renovação criado automaticamente.`,
            metadata: { deal_id: newDeal.id, contract_id: contract.id },
          });
        }

        results.push({
          nome: contactNome,
          status: "DEAL_CRIADO",
          deal_id: newDeal.id,
          dias_restantes: diasRestantes,
        });
      } catch (err) {
        log.error("Erro processando contrato", { error: String(err), contract_id: contract.id });
        results.push({ contract_id: contract.id, status: "ERRO", error: String(err) });
      }
    }

    return json({
      success: true,
      source: "cs_contracts",
      message: `Processados ${results.length} contratos próximos da renovação.`,
      processed: results.length,
      results,
    });
  } catch (err) {
    log.captureException(err instanceof Error ? err : new Error(String(err)));
    return json({ success: false, error: String(err) }, 500);
  }
});
