// ========================================
// CALENDAR SLOTS — Find available time slots for a seller
// Combines user_availability config + Google Calendar FreeBusy API
// Returns 3 best available slots
//
// POST { vendedor_id, empresa, num_slots?: 3 }
// Returns { slots: [{ inicio, fim, label }], vendedor_nome }
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('calendar-slots');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeSlot {
  inicio: string; // ISO datetime
  fim: string;    // ISO datetime
  label: string;  // "Terça, 04/03 às 10:00"
}

interface AvailabilityRow {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
}

interface MeetingConfigRow {
  duracao_minutos: number;
  intervalo_entre_reunioes: number;
  antecedencia_minima_horas: number;
  antecedencia_maxima_dias: number;
  fuso_horario: string;
}

interface GoogleBusyBlock {
  start: string;
  end: string;
}

// ========================================
// HELPERS
// ========================================

const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function formatSlotLabel(date: Date, tz: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}/${month} às ${hour}:${minute}`;
}

function getDateInTz(date: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
    weekday: 'short', timeZone: tz,
  }).formatToParts(date);
  
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  
  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    hour: parseInt(get('hour')) % 24,
    minute: parseInt(get('minute')),
    dayOfWeek: weekdayMap[get('weekday')] ?? 0,
  };
}

function createDateInTz(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  // Create a date string and parse it in the target timezone
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  // Use a temporary formatter to find the UTC offset for this datetime in the timezone
  const tempDate = new Date(dateStr + 'Z');
  const utcStr = tempDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = tempDate.toLocaleString('en-US', { timeZone: tz });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  const offset = utcDate.getTime() - tzDate.getTime();
  return new Date(tempDate.getTime() + offset);
}

function isSlotBusy(slotStart: Date, slotEnd: Date, busyBlocks: GoogleBusyBlock[]): boolean {
  for (const block of busyBlocks) {
    const busyStart = new Date(block.start);
    const busyEnd = new Date(block.end);
    // Overlap check
    if (slotStart < busyEnd && slotEnd > busyStart) return true;
  }
  return false;
}

// ========================================
// REFRESH TOKEN HELPER
// ========================================

async function getValidAccessToken(supabase: ReturnType<typeof createClient>, vendedorId: string): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('user_google_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', vendedorId)
    .single();

  if (!tokenRow) return null;

  const expiry = new Date(tokenRow.token_expiry as string);
  if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return tokenRow.access_token as string;
  }

  // Refresh
  try {
    const resp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/google-calendar-auth`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh', user_id: vendedorId }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.access_token;
    }
  } catch (e) {
    log.error('Token refresh failed', { error: e instanceof Error ? e.message : String(e) });
  }
  return null;
}

// ========================================
// MAIN
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { vendedor_id, empresa, num_slots = 3 } = await req.json();
    if (!vendedor_id) throw new Error('vendedor_id required');

    const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch availability config
    const { data: availRows } = await supabase
      .from('user_availability')
      .select('dia_semana, hora_inicio, hora_fim, ativo')
      .eq('user_id', vendedor_id)
      .eq('ativo', true);

    if (!availRows?.length) {
      return new Response(JSON.stringify({ error: 'Vendedor sem horários configurados', slots: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch meeting config
    const { data: configRow } = await supabase
      .from('user_meeting_config')
      .select('duracao_minutos, intervalo_entre_reunioes, antecedencia_minima_horas, antecedencia_maxima_dias, fuso_horario')
      .eq('user_id', vendedor_id)
      .maybeSingle();

    const config: MeetingConfigRow = {
      duracao_minutos: (configRow?.duracao_minutos as number) || 45,
      intervalo_entre_reunioes: (configRow?.intervalo_entre_reunioes as number) || 15,
      antecedencia_minima_horas: (configRow?.antecedencia_minima_horas as number) || 2,
      antecedencia_maxima_dias: (configRow?.antecedencia_maxima_dias as number) || 14,
      fuso_horario: (configRow?.fuso_horario as string) || 'America/Sao_Paulo',
    };

    // 3. Fetch vendedor name
    const { data: vendedorProfile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', vendedor_id)
      .single();
    const vendedorNome = (vendedorProfile?.nome as string) || 'Consultor';

    // 4. Determine search window
    const now = new Date();
    const minTime = new Date(now.getTime() + config.antecedencia_minima_horas * 60 * 60 * 1000);
    const maxTime = new Date(now.getTime() + config.antecedencia_maxima_dias * 24 * 60 * 60 * 1000);

    // 5. Fetch Google Calendar busy times (if connected)
    let busyBlocks: GoogleBusyBlock[] = [];
    const accessToken = await getValidAccessToken(supabase, vendedor_id);
    
    if (accessToken) {
      try {
        const freeBusyResp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeMin: minTime.toISOString(),
            timeMax: maxTime.toISOString(),
            items: [{ id: 'primary' }],
          }),
        });
        if (freeBusyResp.ok) {
          const freeBusyData = await freeBusyResp.json();
          busyBlocks = freeBusyData.calendars?.primary?.busy || [];
          log.info('FreeBusy fetched', { busyCount: busyBlocks.length });
        }
      } catch (e) {
        log.error('FreeBusy API error', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 6. Also check meetings already booked in our DB
    const { data: existingMeetings } = await supabase
      .from('meetings')
      .select('data_hora_inicio, data_hora_fim')
      .eq('vendedor_id', vendedor_id)
      .in('status', ['AGENDADA', 'CONFIRMADA'])
      .gte('data_hora_inicio', minTime.toISOString())
      .lte('data_hora_inicio', maxTime.toISOString());

    if (existingMeetings?.length) {
      for (const m of existingMeetings) {
        busyBlocks.push({
          start: m.data_hora_inicio as string,
          end: m.data_hora_fim as string,
        });
      }
    }

    // 7. Build availability map by day of week
    const availByDay: Record<number, Array<{ start: string; end: string }>> = {};
    for (const row of availRows as AvailabilityRow[]) {
      if (!availByDay[row.dia_semana]) availByDay[row.dia_semana] = [];
      availByDay[row.dia_semana].push({ start: row.hora_inicio, end: row.hora_fim });
    }

    // 8. Generate candidate slots
    const tz = config.fuso_horario;
    const slotDuration = config.duracao_minutos;
    const buffer = config.intervalo_entre_reunioes;
    const slots: TimeSlot[] = [];

    // Iterate day by day from minTime to maxTime
    let currentDate = new Date(minTime);
    while (currentDate < maxTime && slots.length < num_slots * 3) { // Generate extra candidates
      const tzDate = getDateInTz(currentDate, tz);
      const daySlots = availByDay[tzDate.dayOfWeek];

      if (daySlots) {
        for (const window of daySlots) {
          const [startH, startM] = window.start.split(':').map(Number);
          const [endH, endM] = window.end.split(':').map(Number);

          // Generate slots within this window
          let slotStartH = startH;
          let slotStartM = startM;

          while (true) {
            const slotEndM = slotStartM + slotDuration;
            let slotEndH = slotStartH + Math.floor(slotEndM / 60);
            const slotEndMinute = slotEndM % 60;

            // Check if slot exceeds window
            if (slotEndH > endH || (slotEndH === endH && slotEndMinute > endM)) break;

            const slotStart = createDateInTz(tzDate.year, tzDate.month, tzDate.day, slotStartH, slotStartM, tz);
            const slotEnd = createDateInTz(tzDate.year, tzDate.month, tzDate.day, slotEndH, slotEndMinute, tz);

            // Check if slot is in the future (after minTime)
            if (slotStart >= minTime && !isSlotBusy(slotStart, slotEnd, busyBlocks)) {
              slots.push({
                inicio: slotStart.toISOString(),
                fim: slotEnd.toISOString(),
                label: formatSlotLabel(slotStart, tz),
              });
            }

            // Move to next slot (duration + buffer)
            const nextMinutes = slotStartM + slotDuration + buffer;
            slotStartH = slotStartH + Math.floor(nextMinutes / 60);
            slotStartM = nextMinutes % 60;
          }
        }
      }

      // Move to next day
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      // Reset to start of day in timezone
      const nextTzDate = getDateInTz(currentDate, tz);
      currentDate = createDateInTz(nextTzDate.year, nextTzDate.month, nextTzDate.day, 0, 0, tz);
    }

    // 9. Select best slots (spread across different days/times for variety)
    const selectedSlots: TimeSlot[] = [];
    const usedDays = new Set<string>();

    // First pass: one slot per day
    for (const slot of slots) {
      if (selectedSlots.length >= num_slots) break;
      const dayKey = slot.inicio.substring(0, 10);
      if (!usedDays.has(dayKey)) {
        selectedSlots.push(slot);
        usedDays.add(dayKey);
      }
    }

    // Second pass: fill remaining from any day
    if (selectedSlots.length < num_slots) {
      for (const slot of slots) {
        if (selectedSlots.length >= num_slots) break;
        if (!selectedSlots.includes(slot)) {
          selectedSlots.push(slot);
        }
      }
    }

    log.info('Slots generated', { total: slots.length, selected: selectedSlots.length, vendedor_id });

    return new Response(JSON.stringify({
      slots: selectedSlots,
      vendedor_nome: vendedorNome,
      config: {
        duracao_minutos: config.duracao_minutos,
        fuso_horario: config.fuso_horario,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
