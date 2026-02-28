// ========================================
// ⚠️  ESTE ARQUIVO É REFERÊNCIA — DEVE SER CRIADO NO PROJETO TOKENIZA GOV
// ⚠️  Caminho: supabase/functions/investor-export/index.ts
// ========================================
// investor-export — Exporta investidores com posições e datas de investimento
// Protegido por x-api-key header validado contra secret EXPORT_API_KEY
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("EXPORT_API_KEY");

    if (!expectedKey || !apiKey || apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize Supabase client
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[investor-export] Starting export...");

    // 3. Fetch all investors (paginated to handle 7k+)
    const allInvestors: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: batch, error } = await supabase
        .from("investors")
        .select("id, external_id, full_name, email, phone, document, person_type, kyc_status, suitability, is_active")
        .range(from, from + pageSize - 1)
        .order("created_at", { ascending: true });

      if (error) throw new Error(`Failed to fetch investors: ${error.message}`);
      if (!batch || batch.length === 0) break;

      allInvestors.push(...batch);
      from += pageSize;

      if (batch.length < pageSize) break;
    }

    console.log(`[investor-export] Fetched ${allInvestors.length} investors`);

    // 4. Fetch all positions with deal info and subscription dates
    const allPositions: any[] = [];
    from = 0;

    while (true) {
      const { data: batch, error } = await supabase
        .from("positions")
        .select(`
          id, investor_id, invested_amount, current_value, is_active, subscription_id,
          deals!positions_deal_id_fkey ( name, asset_type, status )
        `)
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`Failed to fetch positions: ${error.message}`);
      if (!batch || batch.length === 0) break;

      allPositions.push(...batch);
      from += pageSize;

      if (batch.length < pageSize) break;
    }

    console.log(`[investor-export] Fetched ${allPositions.length} positions`);

    // 5. Fetch all subscriptions for dates
    const allSubscriptions: any[] = [];
    from = 0;

    while (true) {
      const { data: batch, error } = await supabase
        .from("subscriptions")
        .select("id, investor_id, deal_id, amount, subscribed_at, settled_at, status")
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`Failed to fetch subscriptions: ${error.message}`);
      if (!batch || batch.length === 0) break;

      allSubscriptions.push(...batch);
      from += pageSize;

      if (batch.length < pageSize) break;
    }

    console.log(`[investor-export] Fetched ${allSubscriptions.length} subscriptions`);

    // 6. Index positions and subscriptions by investor_id
    const positionsByInvestor = new Map<string, any[]>();
    for (const pos of allPositions) {
      const arr = positionsByInvestor.get(pos.investor_id) || [];
      arr.push(pos);
      positionsByInvestor.set(pos.investor_id, arr);
    }

    const subscriptionsByKey = new Map<string, any>();
    for (const sub of allSubscriptions) {
      // Index by subscription_id for position matching
      subscriptionsByKey.set(sub.id, sub);
      // Also index by investor_id + deal_id for fallback matching
      const key = `${sub.investor_id}-${sub.deal_id}`;
      if (!subscriptionsByKey.has(key) || new Date(sub.subscribed_at) > new Date(subscriptionsByKey.get(key).subscribed_at)) {
        subscriptionsByKey.set(key, sub);
      }
    }

    // 7. Build response
    const investors = allInvestors.map((inv) => {
      const positions = (positionsByInvestor.get(inv.id) || []).map((pos: any) => {
        // Try to find subscription date: first by subscription_id, then by investor+deal
        let subscriptionData = pos.subscription_id ? subscriptionsByKey.get(pos.subscription_id) : null;
        if (!subscriptionData) {
          const deal = pos.deals;
          subscriptionData = subscriptionsByKey.get(`${inv.id}-${pos.deal_id || deal?.id}`);
        }

        return {
          deal_name: pos.deals?.name || "Unknown",
          deal_asset_type: pos.deals?.asset_type || "other",
          invested_amount: pos.invested_amount || 0,
          current_value: pos.current_value || 0,
          subscribed_at: subscriptionData?.subscribed_at || null,
          status: subscriptionData?.status || (pos.is_active ? "confirmed" : "cancelled"),
          is_active: pos.is_active,
        };
      });

      return {
        external_id: inv.external_id || inv.id,
        full_name: inv.full_name,
        email: inv.email,
        phone: inv.phone,
        document: inv.document,
        person_type: inv.person_type,
        kyc_status: inv.kyc_status,
        suitability: inv.suitability,
        is_active: inv.is_active,
        positions,
      };
    });

    const response = {
      investors,
      total: investors.length,
      exported_at: new Date().toISOString(),
    };

    console.log(`[investor-export] Export complete: ${investors.length} investors`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[investor-export] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
