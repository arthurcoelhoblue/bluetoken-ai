import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { envConfig } from "../_shared/config.ts";

const PLAN_CONFIG = {
  amelia_full: {
    base_price_id: "price_1T8gLHK6xO3NOXxi1JJp4yu6",
    extra_user_price_id: "price_1T8gMGK6xO3NOXxiVC9p676U",
    user_limit: 1,
  },
};

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
    if (userError || !userData.user?.email) throw new Error("Usuário não autenticado");

    const { plan, empresa, extra_users = 0 } = await req.json();
    if (!plan || !PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]) {
      throw new Error("Plano inválido");
    }
    if (!empresa) throw new Error("Empresa não informada");

    const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: userData.user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: planConfig.base_price_id, quantity: 1 },
    ];

    if (extra_users > 0) {
      lineItems.push({ price: planConfig.extra_user_price_id, quantity: extra_users });
    }

    const origin = req.headers.get("origin") || "https://sdrgrupobue.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userData.user.email,
      line_items: lineItems,
      mode: "subscription",
      success_url: `${origin}/assinatura?success=true`,
      cancel_url: `${origin}/assinatura?cancelled=true`,
      metadata: { empresa, plan, extra_users: String(extra_users) },
      subscription_data: {
        metadata: { empresa, plan, user_limit: String(planConfig.user_limit + extra_users) },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
