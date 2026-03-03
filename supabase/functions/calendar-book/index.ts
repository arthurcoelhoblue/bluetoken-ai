// ========================================
// CALENDAR BOOK — Create Google Calendar event with Meet link
// Books a meeting, adds lead as attendee, creates Google Meet link
//
// POST { vendedor_id, empresa, lead_id, deal_id?, convidado_nome, convidado_email?,
//        convidado_telefone?, data_hora_inicio, data_hora_fim }
// Returns { meeting_id, google_event_id, google_meet_link }
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('calendar-book');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  // Refresh token
  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        refresh_token: tokenRow.refresh_token as string,
        grant_type: 'refresh_token',
      }),
    });

    if (refreshResp.ok) {
      const data = await refreshResp.json();
      const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      
      await supabase.from('user_google_tokens').update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      }).eq('user_id', vendedorId);

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
    const {
      vendedor_id,
      empresa,
      lead_id,
      deal_id,
      convidado_nome,
      convidado_email,
      convidado_telefone,
      data_hora_inicio,
      data_hora_fim,
    } = await req.json();

    if (!vendedor_id || !data_hora_inicio || !data_hora_fim) {
      throw new Error('vendedor_id, data_hora_inicio, data_hora_fim required');
    }

    const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get vendedor profile
    const { data: vendedor } = await supabase
      .from('profiles')
      .select('nome, email')
      .eq('id', vendedor_id)
      .single();
    const vendedorNome = (vendedor?.nome as string) || 'Consultor';
    const vendedorEmail = (vendedor?.email as string) || '';

    // 2. Get meeting config
    const { data: configRow } = await supabase
      .from('user_meeting_config')
      .select('google_meet_automatico, fuso_horario')
      .eq('user_id', vendedor_id)
      .maybeSingle();
    const useMeet = (configRow?.google_meet_automatico as boolean) ?? true;
    const tz = (configRow?.fuso_horario as string) || 'America/Sao_Paulo';

    // 3. Get empresa display name
    const empresaNames: Record<string, string> = {
      BLUE: 'Blue Consult',
      TOKENIZA: 'Tokeniza',
      AXIA: 'Axia Investimentos',
      MPUPPE: 'MPuppe Advocacia',
    };
    const empresaDisplay = empresaNames[empresa] || empresa;

    // 4. Build event summary and description
    const summary = `Reunião ${empresaDisplay} — ${convidado_nome || 'Cliente'}`;
    const description = [
      `Reunião comercial ${empresaDisplay}`,
      ``,
      `Consultor: ${vendedorNome}`,
      convidado_nome ? `Cliente: ${convidado_nome}` : null,
      convidado_email ? `Email: ${convidado_email}` : null,
      convidado_telefone ? `Telefone: ${convidado_telefone}` : null,
      ``,
      `Agendado automaticamente pela Amélia — Assistente Comercial IA`,
    ].filter(Boolean).join('\n');

    // 5. Build attendees list
    const attendees: Array<{ email: string; displayName?: string; responseStatus?: string }> = [];
    if (convidado_email) {
      attendees.push({
        email: convidado_email,
        displayName: convidado_nome || undefined,
        responseStatus: 'needsAction',
      });
    }

    // 6. Create Google Calendar event (if connected)
    let googleEventId: string | null = null;
    let googleMeetLink: string | null = null;

    const accessToken = await getValidAccessToken(supabase, vendedor_id);
    
    if (accessToken) {
      try {
        const eventBody: Record<string, unknown> = {
          summary,
          description,
          start: {
            dateTime: data_hora_inicio,
            timeZone: tz,
          },
          end: {
            dateTime: data_hora_fim,
            timeZone: tz,
          },
          attendees,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 15 },
            ],
          },
          // Send email notifications to attendees
          sendUpdates: 'all',
        };

        // Add Google Meet conference
        if (useMeet) {
          eventBody.conferenceData = {
            createRequest: {
              requestId: `amelia-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          };
        }

        const calendarResp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          }
        );

        if (calendarResp.ok) {
          const eventData = await calendarResp.json();
          googleEventId = eventData.id;
          googleMeetLink = eventData.conferenceData?.entryPoints?.find(
            (ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video'
          )?.uri || eventData.hangoutLink || null;
          
          log.info('Google Calendar event created', {
            eventId: googleEventId,
            meetLink: googleMeetLink,
            attendees: attendees.length,
          });
        } else {
          const errText = await calendarResp.text();
          log.error('Google Calendar API error', { status: calendarResp.status, error: errText });
        }
      } catch (e) {
        log.error('Google Calendar event creation failed', { error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      log.warn('No valid access token — meeting saved locally only', { vendedor_id });
    }

    // 7. Save meeting in our database
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        empresa,
        vendedor_id,
        lead_id: lead_id || null,
        deal_id: deal_id || null,
        convidado_nome: convidado_nome || null,
        convidado_email: convidado_email || null,
        convidado_telefone: convidado_telefone || null,
        data_hora_inicio,
        data_hora_fim,
        fuso_horario: tz,
        status: 'AGENDADA',
        google_event_id: googleEventId,
        google_meet_link: googleMeetLink,
        titulo: summary,
        descricao: description,
        agendado_por: 'AMELIA',
      })
      .select('id')
      .single();

    if (meetingError) {
      log.error('Meeting save error', { error: meetingError.message });
      throw meetingError;
    }

    // 8. Create deal activity if deal exists
    if (deal_id) {
      await supabase.from('deal_activities').insert({
        deal_id,
        tipo: 'REUNIAO',
        titulo: summary,
        descricao: `Reunião agendada automaticamente pela Amélia${googleMeetLink ? ` — Meet: ${googleMeetLink}` : ''}`,
        data_agendada: data_hora_inicio,
        status: 'PENDENTE',
        criado_por: vendedor_id,
      }).then(({ error }) => {
        if (error) log.error('Deal activity creation error', { error: error.message });
      });
    }

    log.info('Meeting booked successfully', {
      meeting_id: (meeting as { id: string }).id,
      google_event_id: googleEventId,
      has_meet: !!googleMeetLink,
    });

    return new Response(JSON.stringify({
      meeting_id: (meeting as { id: string }).id,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
      titulo: summary,
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
