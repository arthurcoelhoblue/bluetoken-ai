import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { jobId, action } = body;
    if (!jobId) throw new Error('jobId is required');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ========== EXECUTE BRANCH ==========
    if (action === 'execute') {
      const { data: job, error: jobErr } = await supabase.from('mass_action_jobs').select('*').eq('id', jobId).single();
      if (jobErr || !job) throw new Error('Job not found: ' + jobErr?.message);
      if (job.status !== 'PREVIEW') throw new Error('Job must be in PREVIEW status');

      await supabase.from('mass_action_jobs').update({ status: 'SENDING' }).eq('id', jobId);
      const messagesPreview: Array<{ deal_id: string; contact_name: string; message: string; approved: boolean }> = job.messages_preview || [];
      const approved = messagesPreview.filter(m => m.approved);

      if (approved.length === 0) {
        await supabase.from('mass_action_jobs').update({ status: 'DONE', processed: 0 }).eq('id', jobId);
        return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const canal = job.canal || 'WHATSAPP';
      let sent = 0, errors = 0;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      for (const msg of approved) {
        try {
          const { data: deal } = await supabase.from('deals').select('id, titulo, contacts(id, nome, telefone, email)').eq('id', msg.deal_id).single();
          if (!deal) { errors++; continue; }
          const contact = deal.contacts as any;

          if (canal === 'WHATSAPP') {
            if (!contact?.telefone) { errors++; continue; }
            const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: contact.telefone, message: msg.message, deal_id: msg.deal_id, contact_id: contact?.id }) });
            if (resp.ok) sent++; else { console.error('whatsapp-send error:', await resp.text()); errors++; }
          } else if (canal === 'EMAIL') {
            if (!contact?.email) { errors++; continue; }
            const resp = await fetch(`${supabaseUrl}/functions/v1/email-send`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: contact.email, subject: job.instrucao ? `Re: ${job.instrucao.substring(0, 50)}` : 'Mensagem importante', body: msg.message, deal_id: msg.deal_id, contact_id: contact?.id }) });
            if (resp.ok) sent++; else { console.error('email-send error:', await resp.text()); errors++; }
          }
        } catch (e) { console.error('Send error:', msg.deal_id, e); errors++; }
      }

      await supabase.from('mass_action_jobs').update({ status: errors === approved.length ? 'FAILED' : 'DONE', processed: sent }).eq('id', jobId);
      return new Response(JSON.stringify({ ok: true, sent, errors }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== GENERATE BRANCH ==========
    const { data: job, error: jobErr } = await supabase.from('mass_action_jobs').select('*').eq('id', jobId).single();
    if (jobErr || !job) throw new Error('Job not found: ' + jobErr?.message);

    await supabase.from('mass_action_jobs').update({ status: 'GENERATING' }).eq('id', jobId);
    const dealIds: string[] = job.deal_ids || [];
    const { data: deals } = await supabase.from('deals').select('id, titulo, valor, temperatura, status, contacts(id, nome, telefone, email)').in('id', dealIds);

    if (!deals || deals.length === 0) {
      await supabase.from('mass_action_jobs').update({ status: 'FAILED' }).eq('id', jobId);
      return new Response(JSON.stringify({ error: 'No deals found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messagesPreview: Array<{ deal_id: string; contact_name: string; message: string; approved: boolean }> = [];
    const canal = job.canal || 'WHATSAPP';

    for (const deal of deals) {
      const contact = deal.contacts as any;
      const contactName = contact?.nome || 'Cliente';

      let userPrompt = `Contato: ${contactName}\nDeal: ${deal.titulo || 'Negociação'}\nValor: R$ ${deal.valor || 0}\nTemperatura: ${deal.temperatura || 'não definida'}`;
      if (job.tipo === 'CAMPANHA_ADHOC' && job.instrucao) userPrompt += `\n\nInstrução especial: ${job.instrucao}`;

      try {
        const aiResult = await callAI({
          system: `Você é Amélia, SDR virtual profissional. Gere UMA mensagem personalizada de ${canal === 'WHATSAPP' ? 'WhatsApp' : 'e-mail'}.\nRegras: PT-BR informal+profissional. Curta (máx 3 par WhatsApp, 5 email). Use nome. Direta. Sem markdown. WhatsApp: máx 2 emojis.`,
          prompt: userPrompt,
          functionName: 'amelia-mass-action',
          empresa: job.empresa || null,
          temperature: 0.5,
          maxTokens: 500,
          supabase,
        });

        if (aiResult.content) {
          messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: aiResult.content, approved: true });
        } else {
          messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: '[Erro na geração]', approved: false });
        }
      } catch (e) {
        messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: `[Erro: ${e instanceof Error ? e.message : 'unknown'}]`, approved: false });
      }
    }

    await supabase.from('mass_action_jobs').update({ status: 'PREVIEW', messages_preview: messagesPreview, processed: messagesPreview.length }).eq('id', jobId);
    return new Response(JSON.stringify({ ok: true, count: messagesPreview.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('amelia-mass-action error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
