import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { envConfig, createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = getWebhookCorsHeaders();
const log = createLogger('zadarma-webhook');

function isZadarmaIP(ip: string): boolean {
  if (!ip) return false;
  const clean = ip.split(',')[0].trim();
  const parts = clean.split('.').map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 185 && parts[1] === 45 && parts[2] === 152 && parts[3] >= 40 && parts[3] <= 47;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, '').replace(/^0+/, '');
}

async function createCallDealActivity(supabase: SupabaseClient, callId: string, dealId: string, direcao: string, duration: number, callerNumber: string, destinationNumber: string, recordingUrl: string | null, userId: string | null) {
  const desc = `Chamada ${direcao === 'OUTBOUND' ? 'realizada' : 'recebida'} — ${Math.floor(duration / 60)}m${duration % 60}s` +
    (recordingUrl ? ' (com gravação)' : '');

  await supabase.from('deal_activities').insert({
    deal_id: dealId, tipo: 'LIGACAO', descricao: desc, user_id: userId,
    metadata: { call_id: callId, direcao, duracao_segundos: duration, caller_number: callerNumber, destination_number: destinationNumber, recording_url: recordingUrl },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);
    const eventType = params.get('event') || params.get('zd_echo') || '';

    // Zadarma echo test
    if (params.has('zd_echo')) {
      return new Response(params.get('zd_echo')!, { headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    const supabase = createServiceClient();

    const pbxCallId = params.get('pbx_call_id') || params.get('call_id_with_rec') || '';
    const callerNumber = params.get('caller_id') || params.get('caller_number') || '';
    const destinationNumber = params.get('called_did') || params.get('destination') || '';
    const duration = parseInt(params.get('duration') || '0', 10);
    const internalNumber = params.get('internal') || '';

    // Find empresa from extension mapping
    let empresa: string | null = null;
    let userId: string | null = null;
    if (internalNumber) {
      const { data: ext } = await supabase.from('zadarma_extensions').select('empresa, user_id').eq('extension_number', internalNumber).eq('is_active', true).maybeSingle();
      if (ext) { empresa = ext.empresa; userId = ext.user_id; }
    }

    if (!empresa) {
      const { data: configs } = await supabase.from('zadarma_config').select('empresa').limit(1);
      if (configs && configs.length > 0) empresa = configs[0].empresa;
    }

    if (!empresa) {
      log.error('No Zadarma config found');
      return new Response(JSON.stringify({ error: 'no_config' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Auto-link contact by phone
    let contactId: string | null = null;
    const phoneToSearch = normalizePhone(eventType.includes('OUT') ? destinationNumber : callerNumber);
    if (phoneToSearch && phoneToSearch.length >= 8) {
      const { data: contacts } = await supabase.from('contacts').select('id').eq('empresa', empresa).or(`telefone.ilike.%${phoneToSearch.slice(-9)}%`).limit(1);
      if (contacts && contacts.length > 0) contactId = contacts[0].id;
    }

    // Auto-link deal
    let dealId: string | null = null;
    if (contactId) {
      const { data: deals } = await supabase.from('deals').select('id').eq('contact_id', contactId).eq('status', 'ABERTO').order('created_at', { ascending: false }).limit(1);
      if (deals && deals.length > 0) dealId = deals[0].id;
    }

    const direcao = eventType.includes('OUT') ? 'OUTBOUND' : 'INBOUND';

    if (eventType === 'NOTIFY_START' || eventType === 'NOTIFY_OUT_START') {
      const { data: call } = await supabase.from('calls').insert({
        empresa, deal_id: dealId, contact_id: contactId, user_id: userId, direcao, status: 'RINGING',
        pbx_call_id: pbxCallId, caller_number: callerNumber, destination_number: destinationNumber, started_at: new Date().toISOString(),
      }).select('id').single();

      if (call) {
        await supabase.from('call_events').insert({ call_id: call.id, event_type: eventType, payload: Object.fromEntries(params) });
      }
    } else if (eventType === 'NOTIFY_ANSWER') {
      const { data: existing } = await supabase.from('calls').select('id').eq('pbx_call_id', pbxCallId).maybeSingle();
      if (existing) {
        await supabase.from('calls').update({ status: 'ANSWERED', answered_at: new Date().toISOString() }).eq('id', existing.id);
        await supabase.from('call_events').insert({ call_id: existing.id, event_type: eventType, payload: Object.fromEntries(params) });
      }
    } else if (eventType === 'NOTIFY_END' || eventType === 'NOTIFY_OUT_END') {
      const disposition = params.get('disposition') || '';
      let finalStatus = 'MISSED';
      if (disposition === 'answered') finalStatus = 'ANSWERED';
      else if (disposition === 'busy') finalStatus = 'BUSY';

      const { data: existing } = await supabase.from('calls').select('id, status, deal_id, direcao, caller_number, destination_number, recording_url, user_id').eq('pbx_call_id', pbxCallId).maybeSingle();
      if (existing) {
        const resolvedStatus = existing.status === 'ANSWERED' ? 'ANSWERED' : finalStatus;
        await supabase.from('calls').update({ status: resolvedStatus, duracao_segundos: duration, ended_at: new Date().toISOString() }).eq('id', existing.id);
        await supabase.from('call_events').insert({ call_id: existing.id, event_type: eventType, payload: Object.fromEntries(params) });

        if (existing.deal_id && resolvedStatus === 'ANSWERED' && duration > 0) {
          await createCallDealActivity(supabase, existing.id, existing.deal_id, existing.direcao, duration, existing.caller_number || callerNumber, existing.destination_number || destinationNumber, existing.recording_url, existing.user_id);
        }
      }
    } else if (eventType === 'NOTIFY_RECORD') {
      const recordingUrl = params.get('call_id_with_rec') || '';
      const callIdForRec = params.get('pbx_call_id') || pbxCallId;
      const { data: existing } = await supabase.from('calls').select('id, deal_id').eq('pbx_call_id', callIdForRec).maybeSingle();
      if (existing) {
        await supabase.from('calls').update({ recording_url: recordingUrl }).eq('id', existing.id);
        await supabase.from('call_events').insert({ call_id: existing.id, event_type: eventType, payload: Object.fromEntries(params) });

        try {
          await fetch(`${envConfig.SUPABASE_URL}/functions/v1/call-transcribe`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ call_id: existing.id }),
          });
          log.info('Auto-transcription triggered', { call_id: existing.id });
        } catch (transcribeErr) {
          log.error('Auto-transcription trigger failed', { error: transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr) });
        }
      }
    } else {
      await supabase.from('call_events').insert({ event_type: eventType, payload: Object.fromEntries(params) });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    log.error('Error', { error: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
