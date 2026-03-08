import Stripe from "https://esm.sh/stripe@18.5.0";
import { envConfig, createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("stripe-webhook");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    log.error("Missing Stripe keys");
    return new Response("Server config error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    log.error("Webhook signature verification failed", { error: (err as Error).message });
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createServiceClient();
  log.info("Processing event", { type: event.type });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const empresa = session.metadata?.empresa;
        const plan = session.metadata?.plan || "amelia_full";
        const userLimit = parseInt(session.subscription_data?.metadata?.user_limit || session.metadata?.user_limit || "1", 10);

        if (!empresa) {
          log.error("No empresa in metadata");
          break;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        const { error } = await supabase.from("subscriptions").upsert({
          empresa,
          plan,
          status: "active",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          user_limit: userLimit,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "empresa" });

        if (error) log.error("Error upserting subscription", { error: error.message });
        else log.info("Subscription activated", { empresa, plan, userLimit });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const empresa = subscription.metadata?.empresa;
        if (!empresa) break;

        const userLimit = parseInt(subscription.metadata?.user_limit || "1", 10);
        const status = subscription.status === "active" ? "active" :
                       subscription.status === "past_due" ? "past_due" :
                       subscription.status === "canceled" ? "cancelled" : "inactive";

        const { error } = await supabase.from("subscriptions").update({
          status,
          user_limit: userLimit,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("empresa", empresa);

        if (error) log.error("Error updating subscription", { error: error.message });
        else log.info("Subscription updated", { empresa, status });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const empresa = subscription.metadata?.empresa;
        if (!empresa) break;

        const { error } = await supabase.from("subscriptions").update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("empresa", empresa);

        if (error) log.error("Error cancelling subscription", { error: error.message });
        else log.info("Subscription cancelled", { empresa });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const empresa = sub.metadata?.empresa;
        if (!empresa) break;

        await supabase.from("subscriptions").update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        }).eq("empresa", empresa);

        log.info("Subscription marked past_due", { empresa });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const empresa = sub.metadata?.empresa;
        if (!empresa) break;

        await supabase.from("subscriptions").update({
          status: "active",
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("empresa", empresa);

        log.info("Subscription reactivated via payment", { empresa });
        break;
      }
    }
  } catch (err) {
    log.error("Error processing event", { type: event.type, error: (err as Error).message });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
