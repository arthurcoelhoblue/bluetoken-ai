import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

const MAX_PAGES = 25;
const PAGE_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleWebhookCorsOptions();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const syncUrl = `${SUPABASE_URL}/functions/v1/tokeniza-gov-sync`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    };

    const consolidated = {
      contacts_created: 0, contacts_updated: 0,
      cs_customers_created: 0, cs_customers_updated: 0,
      cs_contracts_created: 0, cs_contracts_updated: 0,
      errors: 0, skipped: 0,
    };

    let page = 0;
    let totalInvestors = 0;
    let totalProcessed = 0;
    let exportedAt = "";

    while (page < MAX_PAGES) {
      console.log(`[orchestrator] Calling tokeniza-gov-sync page=${page}...`);

      const resp = await fetch(syncUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ page, page_size: PAGE_SIZE }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[orchestrator] Page ${page} failed: ${resp.status}`, errText);
        consolidated.errors++;
        break;
      }

      const data = await resp.json();

      if (!data.success) {
        console.error(`[orchestrator] Page ${page} returned error:`, data.error);
        consolidated.errors++;
        break;
      }

      // Consolidate stats
      if (data.stats) {
        for (const key of Object.keys(consolidated) as (keyof typeof consolidated)[]) {
          consolidated[key] += data.stats[key] || 0;
        }
      }

      totalInvestors = data.total_investors || totalInvestors;
      totalProcessed += data.processed || 0;
      exportedAt = data.exported_at || exportedAt;

      console.log(`[orchestrator] Page ${page} done: processed=${data.processed}, has_more=${data.has_more}`);

      if (!data.has_more) break;
      page = data.next_page;
    }

    const result = {
      success: true,
      pages_processed: page + 1,
      total_investors: totalInvestors,
      total_processed: totalProcessed,
      stats: consolidated,
      exported_at: exportedAt,
      completed_at: new Date().toISOString(),
    };

    console.log(`[orchestrator] Complete:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[orchestrator] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
