import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('follow-up-scheduler');
const corsHeaders = getWebhookCorsHeaders();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createServiceClient();

  try {
    const { empresa, canal = "whatsapp" } = await req.json().catch(() => ({}));

    const { data: messages } = await supabase
      .from("lead_messages").select("created_at, direcao, empresa")
      .in("direcao", ["INBOUND", "OUTBOUND"]).order("created_at", { ascending: false }).limit(5000);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: "Sem dados suficientes" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const outbounds = messages.filter((m) => m.direcao === "OUTBOUND");
    const inbounds = messages.filter((m) => m.direcao === "INBOUND");
    const hourStats = new Map<string, { envios: number; respostas: number }>();

    for (const msg of outbounds) {
      const dt = new Date(msg.created_at);
      const key = `${msg.empresa}|${dt.getDay()}|${dt.getHours()}`;
      const stats = hourStats.get(key) || { envios: 0, respostas: 0 };
      stats.envios++;
      const twoHoursLater = new Date(dt.getTime() + 2 * 60 * 60 * 1000);
      const hasResponse = inbounds.some((r) => r.empresa === msg.empresa && new Date(r.created_at) > dt && new Date(r.created_at) < twoHoursLater);
      if (hasResponse) stats.respostas++;
      hourStats.set(key, stats);
    }

    const upsertRows = [];
    for (const [key, stats] of hourStats) {
      const [emp, dow, h] = key.split("|");
      upsertRows.push({ empresa: emp, canal, dia_semana: parseInt(dow), hora: parseInt(h), taxa_resposta: stats.envios > 0 ? (stats.respostas / stats.envios) * 100 : 0, total_envios: stats.envios, total_respostas: stats.respostas, updated_at: new Date().toISOString() });
    }

    if (upsertRows.length > 0) {
      const { error } = await supabase.from("follow_up_optimal_hours").upsert(upsertRows, { onConflict: "empresa,canal,dia_semana,hora" });
      if (error) log.error("Upsert error", { error: error.message });
    }

    return new Response(JSON.stringify({
      processed: outbounds.length, hours_updated: upsertRows.length,
      top_hours: upsertRows.sort((a, b) => b.taxa_resposta - a.taxa_resposta).slice(0, 5).map((r) => `${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][r.dia_semana]} ${r.hora}h: ${r.taxa_resposta.toFixed(0)}%`),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    log.error("Error", { error: error instanceof Error ? error.message : "Erro interno" });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
