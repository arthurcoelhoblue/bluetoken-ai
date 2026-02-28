import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

// Each sync call fetches API data (~5s) + processes 50 investors (~5s) = ~10s.
// Process 1 page per batch to stay safely under 30s. Self-chains for next page.
const PAGES_PER_BATCH = 1;
const PAGE_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleWebhookCorsOptions();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let startPage = 0;
    try {
      const body = await req.json();
      startPage = body.start_page ?? 0;
    } catch { /* default to 0 */ }

    const syncUrl = `${SUPABASE_URL}/functions/v1/tokeniza-gov-sync`;
    const orchestratorUrl = `${SUPABASE_URL}/functions/v1/tokeniza-gov-sync-orchestrator`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    };

    console.log(`[orchestrator] Starting from page ${startPage}, ${PAGES_PER_BATCH} pages of ${PAGE_SIZE}`);

    const consolidated = {
      contacts_created: 0, contacts_updated: 0,
      cs_customers_created: 0, cs_customers_updated: 0,
      cs_contracts_created: 0, cs_contracts_updated: 0,
      errors: 0, skipped: 0,
    };

    let lastPage = startPage;
    let hasMore = true;
    let totalInvestors = 0;
    let exportedAt = "";

    for (let i = 0; i < PAGES_PER_BATCH; i++) {
      const page = startPage + i;

      console.log(`[orchestrator] Calling sync page ${page}...`);

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
        console.error(`[orchestrator] Page ${page} error:`, data.error);
        consolidated.errors++;
        break;
      }

      if (data.stats) {
        for (const key of Object.keys(consolidated) as (keyof typeof consolidated)[]) {
          consolidated[key] += data.stats[key] || 0;
        }
      }

      totalInvestors = data.total_investors || totalInvestors;
      exportedAt = data.exported_at || exportedAt;
      lastPage = page;
      hasMore = data.has_more ?? false;
      console.log(`[orchestrator] Page ${page}: processed=${data.processed}, contracts=${data.stats?.cs_contracts_created || 0}`);

      if (!hasMore) break;
    }

    const nextPage = hasMore ? lastPage + 1 : null;

    // Self-chain: fire next batch without waiting
    if (hasMore && nextPage !== null) {
      console.log(`[orchestrator] Chaining to page ${nextPage}...`);
      fetch(orchestratorUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ start_page: nextPage }),
      }).catch(err => console.error(`[orchestrator] Chain failed:`, err));
    }

    const result = {
      success: true,
      batch_start_page: startPage,
      batch_end_page: lastPage,
      total_investors: totalInvestors,
      stats: consolidated,
      has_more: hasMore,
      next_page: nextPage,
      exported_at: exportedAt,
      completed_at: new Date().toISOString(),
    };

    console.log(`[orchestrator] Batch done:`, JSON.stringify(result));

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
