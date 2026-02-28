// ========================================
// tokeniza-gov-sync — Consome API do Tokeniza Gov e popula contacts, cs_customers, cs_contracts
// Suporta paginação: POST { page: 0, page_size: 500 }
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

interface Position {
  deal_name: string;
  deal_asset_type: string;
  invested_amount: number;
  current_value: number;
  subscribed_at: string;
  status: string;
  is_active: boolean;
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

const STATUS_MAP: Record<string, string> = {
  confirmed: "ATIVO",
  settled: "ATIVO",
  pending: "PENDENTE",
  cancelled: "CANCELADO",
};

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

    // Parse pagination params
    let page = 0;
    let pageSize = 500;
    try {
      const body = await req.json();
      page = body.page ?? 0;
      pageSize = Math.min(body.page_size ?? 500, 1000);
    } catch { /* empty body = page 0 */ }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[tokeniza-gov-sync] Fetching investors from Tokeniza Gov (page=${page}, size=${pageSize})...`);

    // 1. Fetch all data from Tokeniza Gov API (API returns all at once)
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

    const data: ExportResponse = await apiResp.json();
    const totalInvestors = data.investors.length;
    const startIdx = page * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalInvestors);
    const slice = data.investors.slice(startIdx, endIdx);

    console.log(`[tokeniza-gov-sync] Total: ${totalInvestors}, processing slice [${startIdx}..${endIdx}] (${slice.length} investors)`);

    if (slice.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No more investors to process", page, total: totalInvestors }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Process each investor in this slice
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
        const hasActivePositions = investor.positions?.some((p) => p.is_active) ?? false;
        const isCliente = hasActivePositions && investor.is_active;
        const tags = buildContactTags(investor, isCliente);

        // 2a. Upsert contact
        const { data: existingContact } = await supabase
          .from("contacts").select("id").eq("cpf", cpfClean).eq("empresa", "TOKENIZA").maybeSingle();

        let contactId: string;

        if (existingContact) {
          const { error: updateErr } = await supabase.from("contacts").update({
            nome: investor.full_name,
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

        // 2b. Upsert cs_customer
        const activePositions = investor.positions?.filter((p) => p.is_active) ?? [];
        const totalInvested = activePositions.reduce((sum, p) => sum + (p.invested_amount || 0), 0);
        const firstInvestmentDate = investor.positions
          ?.filter((p) => p.subscribed_at)
          .sort((a, b) => new Date(a.subscribed_at).getTime() - new Date(b.subscribed_at).getTime())
          [0]?.subscribed_at;

        const customerTags: string[] = ["tokeniza-gov-sync", "tokeniza-investidor"];
        const dealNames = [...new Set(activePositions.map((p) => p.deal_name))];
        dealNames.forEach((name) => customerTags.push(`projeto:${name}`));
        if (activePositions.length > 0) customerTags.push(`investimentos:${activePositions.length}`);

        const sgtExtras: Record<string, unknown> = {
          tokeniza_valor_investido: totalInvested,
          tokeniza_qtd_investimentos: activePositions.length,
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

        // 2c. Upsert cs_contracts
        if (investor.positions?.length) {
          for (const pos of investor.positions) {
            const posStatus = (pos.status || "").toLowerCase();
            if (posStatus !== "confirmed" && posStatus !== "settled") continue;

            const subscDate = new Date(pos.subscribed_at || "");
            const anoFiscal = isNaN(subscDate.getTime()) ? new Date().getFullYear() : subscDate.getFullYear();
            const ofertaId = `${investor.external_id}-${pos.deal_name}-${pos.subscribed_at || "unknown"}`;

            const { data: existingContract } = await supabase
              .from("cs_contracts").select("id").eq("customer_id", csCustomer.id).eq("oferta_id", ofertaId).maybeSingle();

            const { error: contractErr } = await supabase.from("cs_contracts").upsert({
              customer_id: csCustomer.id, empresa: "TOKENIZA",
              ano_fiscal: anoFiscal, plano: pos.deal_name || "Investimento",
              oferta_id: ofertaId, oferta_nome: pos.deal_name || null,
              tipo: pos.deal_asset_type || "crowdfunding",
              valor: pos.invested_amount || 0,
              data_contratacao: pos.subscribed_at || null,
              status: STATUS_MAP[posStatus] || "ATIVO",
              notas: "Importado via tokeniza-gov-sync",
            }, { onConflict: "customer_id,ano_fiscal,oferta_id" });

            if (contractErr) { console.error(`[sync] contract:`, contractErr.message); stats.errors++; }
            else if (existingContract) stats.cs_contracts_updated++; else stats.cs_contracts_created++;
          }
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
