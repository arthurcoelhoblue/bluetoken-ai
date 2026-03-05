import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

// Known timezone offsets (hours from UTC)
const TIMEZONE_OFFSETS: Record<string, number> = {
  "America/Sao_Paulo": -3,
  "America/Fortaleza": -3,
  "America/Manaus": -4,
  "America/Cuiaba": -4,
  "America/Rio_Branco": -5,
  "America/Noronha": -2,
  "Europe/Lisbon": 0, // WET (winter), +1 WEST (summer)
  "Europe/London": 0,
  "Europe/Madrid": 1,
  "Europe/Paris": 1,
  "Europe/Berlin": 1,
  "Europe/Rome": 1,
  "Europe/Amsterdam": 1,
  "US/Eastern": -5,
  "US/Central": -6,
  "US/Pacific": -8,
};

/**
 * Get the UTC offset in hours for a timezone, accounting for DST via Intl API.
 */
function getTimezoneOffsetHours(tz: string, date: Date): number {
  try {
    // Use Intl to get the actual offset including DST
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === "timeZoneName");
    if (tzPart) {
      // Format: "GMT+1", "GMT-3", "GMT+5:30", "GMT"
      const match = tzPart.value.match(/GMT([+-]?\d+)?(?::(\d+))?/);
      if (match) {
        const hours = match[1] ? parseInt(match[1]) : 0;
        const minutes = match[2] ? parseInt(match[2]) : 0;
        return hours + (minutes / 60) * Math.sign(hours || 1);
      }
    }
  } catch {
    // Fallback to static map
  }
  return TIMEZONE_OFFSETS[tz] ?? -3; // default BRT
}

/**
 * Create a Date representing a specific local time in a given timezone.
 * E.g., localDateInTz(2026-03-06, 9, 0, "America/Sao_Paulo") → Date for 09:00 BRT in UTC
 */
function localDateInTz(baseDate: Date, hours: number, minutes: number, tz: string): Date {
  // Start with UTC midnight of the base date
  const utc = Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), hours, minutes, 0, 0);
  const offset = getTimezoneOffsetHours(tz, new Date(utc));
  // Subtract offset to convert local → UTC
  return new Date(utc - offset * 3600000);
}

/**
 * Format a UTC Date into a local time string for a given timezone.
 */
function formatLocalTime(date: Date, tz: string): { hours: number; minutes: number } {
  const offset = getTimezoneOffsetHours(tz, date);
  const local = new Date(date.getTime() + offset * 3600000);
  return { hours: local.getUTCHours(), minutes: local.getUTCMinutes() };
}

/**
 * Get day of week in a timezone.
 */
function getDayOfWeekInTz(date: Date, tz: string): number {
  const offset = getTimezoneOffsetHours(tz, date);
  const local = new Date(date.getTime() + offset * 3600000);
  return local.getUTCDay();
}

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
    const sellerTz = config.timezone || "America/Sao_Paulo";
    const tokens = tokensRes.data;

    // Fallback: default Mon-Fri 09:00-18:00 if no availability configured
    const availability = (availRes.data && availRes.data.length > 0)
      ? availRes.data
      : [
          { dia_semana: 1, hora_inicio: '09:00', hora_fim: '18:00', ativo: true },
          { dia_semana: 2, hora_inicio: '09:00', hora_fim: '18:00', ativo: true },
          { dia_semana: 3, hora_inicio: '09:00', hora_fim: '18:00', ativo: true },
          { dia_semana: 4, hora_inicio: '09:00', hora_fim: '18:00', ativo: true },
          { dia_semana: 5, hora_inicio: '09:00', hora_fim: '18:00', ativo: true },
        ];
    if (availRes.data?.length === 0) {
      console.warn("No user_availability configured for owner", owner_id, "— using default Mon-Fri 09:00-18:00");
    }

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

    // Generate candidate slots using seller's timezone
    const duracao = config.duracao_minutos || 30;
    const buffer = config.buffer_minutos || 10;
    const slotDuration = duracao + buffer;
    const candidates: Array<{ start: Date; end: Date; label: string }> = [];

    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

    // Labels are always shown in BRT (leads are Brazilian)
    const labelTz = "America/Sao_Paulo";

    for (let d = 0; d < days_ahead && candidates.length < num_slots * 3; d++) {
      const dayOffset = new Date(now.getTime() + (d + 1) * 24 * 60 * 60 * 1000);
      
      // Get the day of week in the seller's timezone
      const dow = getDayOfWeekInTz(dayOffset, sellerTz);
      const avail = availMap.get(dow);
      if (!avail) continue;

      const [startH, startM] = avail.start.split(":").map(Number);
      const [endH, endM] = avail.end.split(":").map(Number);

      // Create start/end times in seller's timezone, converted to UTC
      const dayStart = localDateInTz(dayOffset, startH, startM, sellerTz);
      const dayEnd = localDateInTz(dayOffset, endH, endM, sellerTz);

      // Skip if dayStart is in the past
      if (dayStart.getTime() < now.getTime()) continue;

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
          // Format label in lead's timezone (BRT)
          const localTime = formatLocalTime(cursor, labelTz);
          const localDay = new Date(cursor.getTime() + getTimezoneOffsetHours(labelTz, cursor) * 3600000);
          const label = `${dayNames[localDay.getUTCDay()]}, ${localDay.getUTCDate()} ${monthNames[localDay.getUTCMonth()]} às ${String(localTime.hours).padStart(2, "0")}:${String(localTime.minutes).padStart(2, "0")}`;
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

    return json({ slots, total: slots.length, timezone: sellerTz });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
