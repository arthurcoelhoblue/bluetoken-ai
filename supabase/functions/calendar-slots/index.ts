import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { owner_id, num_slots = 3, days_ahead = 14 } = await req.json();
    if (!owner_id) return json({ error: "owner_id obrigatório" }, 400);

    const supabase = createServiceClient();

    // Load config + availability + tokens
    const [configRes, availRes, tokensRes] = await Promise.all([
      supabase.from("user_meeting_config").select("*").eq("user_id", owner_id).maybeSingle(),
      supabase.from("user_availability").select("*").eq("user_id", owner_id).eq("ativo", true),
      supabase.from("user_google_tokens").select("*").eq("user_id", owner_id).maybeSingle(),
    ]);

    const config = configRes.data || { duracao_minutos: 30, buffer_minutos: 10, max_por_dia: 8, timezone: "America/Sao_Paulo" };
    const availability = availRes.data || [];
    const tokens = tokensRes.data;

    if (availability.length === 0) return json({ error: "Nenhuma disponibilidade configurada" }, 400);

    // Refresh token if needed
    let accessToken = tokens?.access_token;
    if (tokens && new Date(tokens.token_expiry) <= new Date()) {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return json({ error: "Google Calendar credentials not configured" }, 500);
      const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokens.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshResp.json();
      if (refreshResp.ok) {
        accessToken = refreshData.access_token;
        await supabase.from("user_google_tokens").update({
          access_token: refreshData.access_token,
          token_expiry: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
        }).eq("user_id", owner_id);
      }
    }

    // Get Google Calendar busy times
    const now = new Date();
    const end = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);
    let busyPeriods: Array<{ start: string; end: string }> = [];

    if (accessToken) {
      try {
        const freeBusyResp = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            timeMin: now.toISOString(),
            timeMax: end.toISOString(),
            items: [{ id: "primary" }],
          }),
        });
        if (freeBusyResp.ok) {
          const fbData = await freeBusyResp.json();
          busyPeriods = fbData.calendars?.primary?.busy || [];
        }
      } catch (e) {
        console.warn("FreeBusy API failed:", e);
      }
    }

    // Get existing meetings
    const { data: existingMeetings } = await supabase
      .from("meetings")
      .select("data_inicio, data_fim")
      .eq("owner_id", owner_id)
      .gte("data_inicio", now.toISOString())
      .lte("data_inicio", end.toISOString())
      .in("status", ["AGENDADA", "CONFIRMADA"]);

    // Add existing meetings to busy periods
    for (const m of existingMeetings || []) {
      busyPeriods.push({ start: m.data_inicio, end: m.data_fim });
    }

    // Build availability map (day of week → time ranges)
    const availMap = new Map<number, { start: string; end: string }>();
    for (const a of availability) {
      availMap.set(a.dia_semana, { start: a.hora_inicio, end: a.hora_fim });
    }

    // Generate candidate slots
    const duracao = config.duracao_minutos || 30;
    const buffer = config.buffer_minutos || 10;
    const slotDuration = duracao + buffer;
    const candidates: Array<{ start: Date; end: Date; label: string }> = [];

    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

    for (let d = 0; d < days_ahead && candidates.length < num_slots * 3; d++) {
      const day = new Date(now.getTime() + (d + 1) * 24 * 60 * 60 * 1000);
      const dow = day.getDay();
      const avail = availMap.get(dow);
      if (!avail) continue;

      const [startH, startM] = avail.start.split(":").map(Number);
      const [endH, endM] = avail.end.split(":").map(Number);

      const dayStart = new Date(day);
      dayStart.setHours(startH, startM, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(endH, endM, 0, 0);

      let cursor = new Date(dayStart);
      while (cursor.getTime() + duracao * 60000 <= dayEnd.getTime()) {
        const slotEnd = new Date(cursor.getTime() + duracao * 60000);

        // Check conflicts
        const hasConflict = busyPeriods.some(bp => {
          const bStart = new Date(bp.start).getTime();
          const bEnd = new Date(bp.end).getTime();
          return cursor.getTime() < bEnd && slotEnd.getTime() > bStart;
        });

        if (!hasConflict) {
          const label = `${dayNames[dow]}, ${day.getDate()} ${monthNames[day.getMonth()]} às ${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`;
          candidates.push({ start: new Date(cursor), end: slotEnd, label });
        }

        cursor = new Date(cursor.getTime() + slotDuration * 60000);
      }
    }

    // Diversify: spread across different days
    const byDay = new Map<string, typeof candidates>();
    for (const c of candidates) {
      const key = c.start.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(c);
    }

    const selected: typeof candidates = [];
    const dayKeys = Array.from(byDay.keys());
    let idx = 0;
    while (selected.length < num_slots && idx < dayKeys.length * 3) {
      const dayKey = dayKeys[idx % dayKeys.length];
      const daySlots = byDay.get(dayKey)!;
      const pick = daySlots.shift();
      if (pick) selected.push(pick);
      if (daySlots.length === 0) dayKeys.splice(idx % dayKeys.length, 1);
      else idx++;
      if (dayKeys.length === 0) break;
    }

    const slots = selected.slice(0, num_slots).map((s, i) => ({
      id: i + 1,
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      label: s.label,
      duracao_minutos: duracao,
    }));

    return json({ slots, total: slots.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
