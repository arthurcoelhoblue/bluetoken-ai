import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { envConfig, createServiceClient } from "../_shared/config.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_ANON_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Usuário não autenticado");

    const { empresa } = await req.json();
    if (!empresa) throw new Error("Empresa não informada");

    const adminClient = createServiceClient();

    // Get subscription
    const { data: subscription } = await adminClient
      .from("subscriptions")
      .select("*")
      .eq("empresa", empresa)
      .single();

    // Count active users for this empresa
    const { count: activeUsers } = await adminClient
      .from("user_access_assignments")
      .select("*", { count: "exact", head: true })
      .eq("empresa", empresa);

    return new Response(JSON.stringify({
      subscription: subscription || { plan: "free", status: "inactive", user_limit: 0 },
      active_users: activeUsers || 0,
      can_add_user: subscription ? (activeUsers || 0) < subscription.user_limit : false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
