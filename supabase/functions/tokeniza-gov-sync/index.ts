// ========================================
// tokeniza-gov-sync — Consome API do Tokeniza Gov e popula contacts, cs_customers, cs_contracts
// Suporta paginação: POST { page: 0, page_size: 50 }
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

interface Position {
  position_id: string;
  deal_id: string;
  deal_name: string;
  deal_asset_type: string;
  invested_amount: number;
  current_value: number;
  subscribed_at: string;
  settled_at: string | null;
}

interface Investor {
  external_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document: string;
  person_type: "pf" | "pj";
  kyc_status: string;
  suitability: string | null;
  is_active: boolean;
  positions: Position[];
}

interface ExportResponse {
  investors: Investor[];
  total: number;
  exported_at: string;
}

function buildContactTags(investor: Investor, isCliente: boolean): string[] {
  const tags: string[] = ["tokeniza-gov-sync"];
  tags.push(isCliente ? "investidor-ativo" : "cadastrado-sem-investimento");
  if (investor.suitability) tags.push(`perfil:${investor.suitability}`);
  if (investor.person_type) tags.push(`tipo:${investor.person_type}`);
  return tags;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleWebhookCorsOptions();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TOKENIZA_GOV_API_URL = Deno.env.get("TOKENIZA_GOV_API_URL");
    const TOKENIZA_GOV_API_KEY = Deno.env.get("TOKENIZA_GOV_API_KEY");

    if (!TOKENIZA_GOV_API_URL || !TOKENIZA_GOV_API_KEY) {
      return new Response(
        JSON.stringify({ error: "TOKENIZA_GOV_API_URL and TOKENIZA_GOV_API_KEY must be configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let page = 0;
    let pageSize = 50;
    let cachedData: ExportResponse | null = null;
    try {
      const body = await req.json();
      page = body.page ?? 0;
      pageSize = Math.min(body.page_size ?? 50, 200);
      if (body._cached_data) cachedData = body._cached_data as ExportResponse;
    } catch { /* empty body = page 0 */ }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let data: ExportResponse;

    if (cachedData) {
      data = cachedData;
      console.log(`[tokeniza-gov-sync] Using cached data (${data.investors.length} investors)`);
    } else {
      console.log(`[tokeniza-gov-sync] Fetching from Tokeniza Gov (page=${page}, size=${pageSize})...`);
      const apiResp = await fetch(TOKENIZA_GOV_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": TOKENIZA_GOV_API_KEY.replace(/[^\x20-\x7E]/g, ''),
        },
        body: JSON.stringify({}),
      });

      if (!apiResp.ok) {
        const errText = await apiResp.text();
        console.error("[tokeniza-gov-sync] API error:", apiResp.status, errText);
        return new Response(
          JSON.stringify({ error: `Tokeniza Gov API returned ${apiResp.status}`, detail: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      data = await apiResp.json();
    }

    const totalInvestors = data.investors.length;
    const startIdx = page * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalInvestors);
    const slice = data.investors.slice(startIdx, endIdx);

    console.log(`[tokeniza-gov-sync] Total: ${totalInvestors}, slice [${startIdx}..${endIdx}] (${slice.length})`);

    if (slice.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more investors to process", page, total: totalInvestors }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stats = {
      contacts_created: 0, contacts_updated: 0,
      cs_customers_created: 0, cs_customers_updated: 0,
      cs_contracts_created: 0, cs_contracts_updated: 0,
      errors: 0, skipped: 0,
    };

    for (const investor of slice) {
      try {
        if (!investor.document) { stats.skipped++; continue; }

        const cpfClean = investor.document.replace(/\D/g, "");
        // All positions returned by the API are valid investments (invested_amount > 0)
        const hasPositions = (investor.positions?.length ?? 0) > 0;
        const isCliente = hasPositions && investor.is_active;
        const tags = buildContactTags(investor, isCliente);

        // Check existing contact by CPF first, then fallback to email
        let existingContact: { id: string } | null = null;

        const { data: cpfMatch } = await supabase
          .from("contacts").select("id").eq("cpf", cpfClean).eq("empresa", "TOKENIZA").maybeSingle();
        existingContact = cpfMatch;

        // Fallback: search by email if CPF didn't match and email is available
        if (!existingContact && investor.email) {
          const { data: emailMatch } = await supabase
            .from("contacts").select("id").eq("email", investor.email).eq("empresa", "TOKENIZA").maybeSingle();
          existingContact = emailMatch;
        }

        let contactId: string;

        if (existingContact) {
          const { error: updateErr } = await supabase.from("contacts").update({
            nome: investor.full_name,
            cpf: cpfClean, // Always update CPF so future syncs match by CPF
            email: investor.email || undefined,
            telefone: investor.phone || undefined,
            notas: `KYC: ${investor.kyc_status}`,
            tags, is_cliente: isCliente, is_active: investor.is_active,
            canal_origem: "TOKENIZA_GOV", tipo: isCliente ? "CLIENTE" : "LEAD",
            updated_at: new Date().toISOString(),
          }).eq("id", existingContact.id);
          if (updateErr) { console.error(`[sync] contact update ${cpfClean}:`, updateErr.message); stats.errors++; continue; }
          contactId = existingContact.id;
          stats.contacts_updated++;
        } else {
          const { data: newContact, error: insertErr } = await supabase.from("contacts").insert({
            nome: investor.full_name, cpf: cpfClean,
            email: investor.email || null, telefone: investor.phone || null,
            empresa: "TOKENIZA", notas: `KYC: ${investor.kyc_status}`,
            tags, is_cliente: isCliente, is_active: investor.is_active,
            canal_origem: "TOKENIZA_GOV", tipo: isCliente ? "CLIENTE" : "LEAD",
          }).select("id").single();
          if (insertErr || !newContact) { console.error(`[sync] contact insert ${cpfClean}:`, insertErr?.message); stats.errors++; continue; }
          contactId = newContact.id;
          stats.contacts_created++;
        }

        // Upsert cs_customer
        const positions = investor.positions ?? [];
        const totalInvested = positions.reduce((sum, p) => sum + (p.invested_amount || 0), 0);
        const firstInvestmentDate = positions
          .filter((p) => p.subscribed_at)
          .sort((a, b) => new Date(a.subscribed_at).getTime() - new Date(b.subscribed_at).getTime())
          [0]?.subscribed_at;

        const customerTags: string[] = ["tokeniza-gov-sync", "tokeniza-investidor"];
        const dealNames = [...new Set(positions.map((p) => p.deal_name))];
        dealNames.forEach((name) => customerTags.push(`projeto:${name}`));
        if (positions.length > 0) customerTags.push(`investimentos:${positions.length}`);

        const sgtExtras: Record<string, unknown> = {
          tokeniza_valor_investido: totalInvested,
          tokeniza_qtd_investimentos: positions.length,
          tokeniza_projetos: dealNames,
          kyc_status: investor.kyc_status,
          suitability: investor.suitability,
          person_type: investor.person_type,
          external_id: investor.external_id,
        };

        const { data: existingCustomer } = await supabase
          .from("cs_customers").select("id").eq("contact_id", contactId).eq("empresa", "TOKENIZA").maybeSingle();

        const { data: csCustomer, error: csErr } = await supabase.from("cs_customers").upsert({
          contact_id: contactId, empresa: "TOKENIZA", is_active: isCliente,
          valor_mrr: totalInvested,
          data_primeiro_ganho: firstInvestmentDate || new Date().toISOString(),
          tags: customerTags, sgt_dados_extras: sgtExtras,
          sgt_last_sync_at: new Date().toISOString(),
        }, { onConflict: "contact_id,empresa" }).select("id").single();

        if (csErr || !csCustomer) { console.error(`[sync] cs_customer ${cpfClean}:`, csErr?.message); stats.errors++; continue; }
        if (existingCustomer) stats.cs_customers_updated++; else stats.cs_customers_created++;

        // Upsert cs_contracts — ALL positions are valid investments
        for (const pos of positions) {
          const subscDate = new Date(pos.subscribed_at || "");
          const anoFiscal = isNaN(subscDate.getTime()) ? new Date().getFullYear() : subscDate.getFullYear();
          const ofertaId = `${investor.external_id}-${pos.deal_id}-${pos.position_id}`;

          const contractStatus = pos.settled_at ? "ATIVO" : "PENDENTE";

          const { error: contractErr } = await supabase.from("cs_contracts").upsert({
            customer_id: csCustomer.id, empresa: "TOKENIZA",
            ano_fiscal: anoFiscal, plano: pos.deal_name || "Investimento",
            oferta_id: ofertaId, oferta_nome: pos.deal_name || null,
            tipo: pos.deal_asset_type || "crowdfunding",
            valor: pos.invested_amount || 0,
            data_contratacao: pos.subscribed_at || null,
            status: contractStatus,
            notas: "Importado via tokeniza-gov-sync",
          }, { onConflict: "customer_id,ano_fiscal,oferta_id" });

          if (contractErr) { console.error(`[sync] contract:`, contractErr.message); stats.errors++; }
          else stats.cs_contracts_created++;
        }
      } catch (investorErr) {
        console.error(`[sync] investor ${investor.document}:`, investorErr);
        stats.errors++;
      }
    }

    const hasMore = endIdx < totalInvestors;
    console.log(`[tokeniza-gov-sync] Page ${page} done:`, JSON.stringify(stats), `hasMore=${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true, stats, page, page_size: pageSize,
        processed: slice.length, total_investors: totalInvestors,
        has_more: hasMore, next_page: hasMore ? page + 1 : null,
        exported_at: data.exported_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[tokeniza-gov-sync] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
