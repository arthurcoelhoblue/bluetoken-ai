import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient, envConfig } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";
import { assertEmpresa } from "../_shared/tenant.ts";

const log = createLogger('amelia-mass-action');

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { jobId, action } = body;
    if (!jobId) throw new Error('jobId is required');

    const supabase = createServiceClient();

    // ========== RETRY PENDING BRANCH ==========
    if (action === 'retry_pending') {
      const { data: job, error: jobErr } = await supabase.from('mass_action_jobs').select('*').eq('id', jobId).single();
      if (jobErr || !job) throw new Error('Job not found: ' + jobErr?.message);

      assertEmpresa(job.empresa);
      const jobEmpresa = job.empresa;

      const messagesPreview: Array<{ deal_id: string; contact_name: string; message: string; approved: boolean; template_status?: string; suggested_template_id?: string }> = job.messages_preview || [];
      const pendingMessages = messagesPreview.filter(m => m.template_status === 'PENDING_META' && m.suggested_template_id);

      if (pendingMessages.length === 0) {
        return new Response(JSON.stringify({ ok: true, message: 'No pending messages' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Collect unique template IDs to check
      const templateIds = [...new Set(pendingMessages.map(m => m.suggested_template_id!))];
      const { data: templates } = await supabase.from('message_templates')
        .select('id, meta_status, meta_template_id, meta_language, meta_components, codigo')
        .in('id', templateIds);

      const approvedTemplateIds = new Set((templates || []).filter(t => t.meta_status === 'APPROVED').map(t => t.id));
      let updated = 0;

      for (const msg of messagesPreview) {
        if (msg.template_status === 'PENDING_META' && msg.suggested_template_id && approvedTemplateIds.has(msg.suggested_template_id)) {
          msg.template_status = 'APPROVED';
          msg.approved = true;
          updated++;
        }
      }

      const stillPending = messagesPreview.filter(m => m.template_status === 'PENDING_META').length;
      const newStatus = stillPending > 0 ? 'AGUARDANDO_TEMPLATE' : 'PREVIEW';

      await supabase.from('mass_action_jobs').update({ 
        messages_preview: messagesPreview, 
        status: newStatus 
      }).eq('id', jobId);

      // If all approved now, try to send pending ones
      if (updated > 0 && stillPending === 0) {
        log.info('All pending templates now approved, job moved to PREVIEW', { jobId, updated });
      }

      return new Response(JSON.stringify({ ok: true, updated, stillPending }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== EXECUTE BRANCH ==========
    if (action === 'execute') {
      const { data: job, error: jobErr } = await supabase.from('mass_action_jobs').select('*').eq('id', jobId).single();
      if (jobErr || !job) throw new Error('Job not found: ' + jobErr?.message);
      if (!['PREVIEW', 'AGUARDANDO_TEMPLATE'].includes(job.status)) throw new Error('Job must be in PREVIEW or AGUARDANDO_TEMPLATE status');

      // Validate approval if needed
      if (job.needs_approval && !job.approved_by) {
        throw new Error('Job requires approval before execution');
      }

      assertEmpresa(job.empresa);
      const jobEmpresa = job.empresa;

      await supabase.from('mass_action_jobs').update({ status: 'SENDING' }).eq('id', jobId);
      const messagesPreview: Array<{ deal_id: string; contact_name: string; message: string; approved: boolean; template_status?: string; suggested_template_id?: string }> = job.messages_preview || [];
      
      // Only send messages that are approved AND have approved template status
      const approved = messagesPreview.filter(m => m.approved && m.template_status !== 'PENDING_META');
      const pendingMeta = messagesPreview.filter(m => m.template_status === 'PENDING_META');

      if (approved.length === 0) {
        const finalStatus = pendingMeta.length > 0 ? 'AGUARDANDO_TEMPLATE' : 'DONE';
        await supabase.from('mass_action_jobs').update({ status: finalStatus, processed: 0 }).eq('id', jobId);
        return new Response(JSON.stringify({ ok: true, sent: 0, pendingMeta: pendingMeta.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const canal = job.canal || 'WHATSAPP';
      let sent = 0, errors = 0;
      const supabaseUrl = envConfig.SUPABASE_URL;
      const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

      // Check if this is a template-based mass action
      let metaTemplateInfo: { metaTemplateName: string; metaLanguage: string; metaComponents?: unknown } | null = null;
      if (job.template_id) {
        const { data: tmpl } = await supabase.from('message_templates')
          .select('meta_template_id, meta_status, meta_language, meta_components, codigo')
          .eq('id', job.template_id)
          .single();
        if (tmpl?.meta_template_id && tmpl?.meta_status === 'APPROVED') {
          metaTemplateInfo = {
            metaTemplateName: tmpl.meta_template_id,
            metaLanguage: tmpl.meta_language || 'pt_BR',
            metaComponents: tmpl.meta_components,
          };
          log.info('Template Meta Cloud para mass action', { template: tmpl.codigo });
        }
      }

      // Fetch pipelines for tenant filtering
      const { data: execPipelines } = await supabase.from('pipelines').select('id').eq('empresa', jobEmpresa);
      const execPipelineIds = new Set((execPipelines || []).map(p => p.id));

      for (const msg of approved) {
        try {
          const { data: deal } = await supabase.from('deals').select('id, titulo, pipeline_id, contacts(id, nome, telefone, email)')
            .eq('id', msg.deal_id).single();
          if (!deal || !execPipelineIds.has(deal.pipeline_id)) { errors++; continue; }
          const contact = deal.contacts as { id?: string; nome?: string; telefone?: string; email?: string } | null;

          // For messages with their own suggested template, use that template's Meta info
          let msgTemplateInfo = metaTemplateInfo;
          if (msg.suggested_template_id) {
            const { data: sugTmpl } = await supabase.from('message_templates')
              .select('meta_template_id, meta_status, meta_language, meta_components')
              .eq('id', msg.suggested_template_id)
              .single();
            if (sugTmpl?.meta_template_id && sugTmpl?.meta_status === 'APPROVED') {
              msgTemplateInfo = {
                metaTemplateName: sugTmpl.meta_template_id,
                metaLanguage: sugTmpl.meta_language || 'pt_BR',
                metaComponents: sugTmpl.meta_components,
              };
            }
          }

          if (canal === 'WHATSAPP') {
            if (!contact?.telefone) { errors++; continue; }
            const payload: Record<string, unknown> = {
              to: contact.telefone, message: msg.message, deal_id: msg.deal_id, contact_id: contact?.id,
              leadId: msg.deal_id, telefone: contact.telefone, mensagem: msg.message, empresa: jobEmpresa,
            };
            if (msgTemplateInfo) {
              payload.metaTemplateName = msgTemplateInfo.metaTemplateName;
              payload.metaLanguage = msgTemplateInfo.metaLanguage;
              if (msgTemplateInfo.metaComponents) payload.metaComponents = msgTemplateInfo.metaComponents;
            }
            const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (resp.ok) sent++; else { log.error('whatsapp-send error', { error: await resp.text() }); errors++; }
          } else if (canal === 'EMAIL') {
            if (!contact?.email) { errors++; continue; }
            const resp = await fetch(`${supabaseUrl}/functions/v1/email-send`, { method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: contact.email, subject: job.instrucao ? `Re: ${job.instrucao.substring(0, 50)}` : 'Mensagem importante', body: msg.message, deal_id: msg.deal_id, contact_id: contact?.id }) });
            if (resp.ok) sent++; else { log.error('email-send error', { error: await resp.text() }); errors++; }
          }
        } catch (e) { log.error('Send error', { deal_id: msg.deal_id, error: String(e) }); errors++; }
      }

      // Determine final status
      let finalStatus = 'DONE';
      if (errors === approved.length) finalStatus = 'FAILED';
      else if (pendingMeta.length > 0) finalStatus = 'PARTIAL';

      await supabase.from('mass_action_jobs').update({ status: finalStatus, processed: sent }).eq('id', jobId);
      return new Response(JSON.stringify({ ok: true, sent, errors, pendingMeta: pendingMeta.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== GENERATE BRANCH ==========
    const { data: job, error: jobErr } = await supabase.from('mass_action_jobs').select('*').eq('id', jobId).single();
    if (jobErr || !job) throw new Error('Job not found: ' + jobErr?.message);

    assertEmpresa(job.empresa);
    const jobEmpresa = job.empresa;

    await supabase.from('mass_action_jobs').update({ status: 'GENERATING' }).eq('id', jobId);
    const dealIds: string[] = job.deal_ids || [];

    // Fetch pipelines for tenant filtering
    const { data: tenantPipelines } = await supabase.from('pipelines').select('id').eq('empresa', jobEmpresa);
    const genPipelineIds = new Set((tenantPipelines || []).map(p => p.id));

    const { data: allDeals } = await supabase.from('deals').select('id, titulo, valor, temperatura, status, pipeline_id, contacts(id, nome, telefone, email)')
      .in('id', dealIds);
    const deals = (allDeals || []).filter(d => genPipelineIds.has(d.pipeline_id));

    if (!deals || deals.length === 0) {
      await supabase.from('mass_action_jobs').update({ status: 'FAILED' }).eq('id', jobId);
      return new Response(JSON.stringify({ error: 'No deals found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch the selected template content
    let templateContent: string | null = null;
    let templateCodigo: string | null = null;
    if (job.template_id) {
      const { data: tmpl } = await supabase.from('message_templates')
        .select('conteudo, codigo, meta_status')
        .eq('id', job.template_id)
        .single();
      if (tmpl) {
        templateContent = tmpl.conteudo;
        templateCodigo = tmpl.codigo;
      }
    }

    const messagesPreview: Array<{ deal_id: string; contact_name: string; message: string; approved: boolean; template_status: string; suggested_template_id: string | null }> = [];
    const canal = job.canal || 'WHATSAPP';
    let hasPendingTemplates = false;

    for (const deal of deals) {
      const contact = deal.contacts as { id?: string; nome?: string; telefone?: string; email?: string } | null;
      const contactName = contact?.nome || 'Cliente';

      // Build context for AI
      let userPrompt = `Contato: ${contactName}\nDeal: ${deal.titulo || 'Negociação'}\nValor: R$ ${deal.valor || 0}\nTemperatura: ${deal.temperatura || 'não definida'}`;
      if (job.instrucao) userPrompt += `\n\nInstrução especial: ${job.instrucao}`;

      // Build system prompt based on whether we have a template
      let systemPrompt: string;
      if (templateContent && canal === 'WHATSAPP') {
        systemPrompt = `Você é Amélia, SDR virtual profissional. Você deve personalizar o template abaixo preenchendo as variáveis com os dados do contato/deal.

TEMPLATE BASE:
${templateContent}

Regras:
1. Preencha variáveis como {{nome}}, {{empresa}}, {{valor}} etc com dados reais do contato
2. Mantenha a estrutura e tom do template
3. Se o template NÃO se adequar ao perfil deste cliente, responda EXATAMENTE no formato:
   [SUGESTAO_NOVO_TEMPLATE]
   Nome: nome_snake_case_do_template
   Categoria: MARKETING ou UTILITY
   Conteúdo: (o conteúdo sugerido)
   [/SUGESTAO_NOVO_TEMPLATE]
4. Se o template se adequar, retorne APENAS a mensagem personalizada (sem marcadores)
5. PT-BR informal+profissional. WhatsApp: máx 2 emojis, máx 3 parágrafos`;
      } else {
        systemPrompt = `Você é Amélia, SDR virtual profissional. Gere UMA mensagem personalizada de ${canal === 'WHATSAPP' ? 'WhatsApp' : 'e-mail'}.\nRegras: PT-BR informal+profissional. Curta (máx 3 par WhatsApp, 5 email). Use nome. Direta. Sem markdown. WhatsApp: máx 2 emojis.`;
      }

      try {
        const aiResult = await callAI({
          system: systemPrompt,
          prompt: userPrompt,
          functionName: 'amelia-mass-action',
          empresa: jobEmpresa,
          temperature: 0.5,
          maxTokens: 800,
          supabase,
        });

        if (aiResult.content) {
          const content = aiResult.content.trim();

          // Check if AI suggested a new template
          if (content.includes('[SUGESTAO_NOVO_TEMPLATE]') && canal === 'WHATSAPP') {
            const match = content.match(/\[SUGESTAO_NOVO_TEMPLATE\]\s*Nome:\s*(.+?)\s*Categoria:\s*(.+?)\s*Conteúdo:\s*([\s\S]+?)\s*\[\/SUGESTAO_NOVO_TEMPLATE\]/);
            if (match) {
              const [, sugName, sugCategory, sugConteudo] = match;
              const cleanName = sugName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 50);
              const cleanCategory = sugCategory.trim().toUpperCase() === 'UTILITY' ? 'UTILITY' : 'MARKETING';

              // Check if similar template already exists
              const { data: existing } = await supabase.from('message_templates')
                .select('id, meta_status')
                .eq('empresa', jobEmpresa)
                .eq('codigo', cleanName)
                .single();

              let suggestedTemplateId: string | null = null;

              if (existing) {
                suggestedTemplateId = existing.id;
                if (existing.meta_status === 'APPROVED') {
                  // Template already approved, use it
                  messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: sugConteudo.trim(), approved: true, template_status: 'APPROVED', suggested_template_id: existing.id });
                  continue;
                }
              } else {
                // Create new local template
                const { data: newTmpl } = await supabase.from('message_templates').insert({
                  empresa: jobEmpresa,
                  nome: `Auto: ${cleanName}`,
                  codigo: cleanName,
                  canal: 'WHATSAPP',
                  conteudo: sugConteudo.trim(),
                  ativo: true,
                  meta_status: 'LOCAL',
                }).select('id').single();

                if (newTmpl) {
                  suggestedTemplateId = newTmpl.id;

                  // Submit to Meta via whatsapp-template-manager
                  try {
                    const supabaseUrl = envConfig.SUPABASE_URL;
                    const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
                    await fetch(`${supabaseUrl}/functions/v1/whatsapp-template-manager?empresa=${encodeURIComponent(jobEmpresa)}`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: cleanName,
                        category: cleanCategory,
                        language: 'pt_BR',
                        components: [{ type: 'BODY', text: sugConteudo.trim() }],
                        localTemplateId: newTmpl.id,
                      }),
                    });
                    log.info('Template submitted to Meta', { name: cleanName, templateId: newTmpl.id });
                  } catch (e) {
                    log.error('Failed to submit template to Meta', { error: String(e) });
                  }
                }
              }

              hasPendingTemplates = true;
              messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: sugConteudo.trim(), approved: false, template_status: 'PENDING_META', suggested_template_id: suggestedTemplateId });
              continue;
            }
          }

          // Normal message with approved template
          messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: content, approved: true, template_status: 'APPROVED', suggested_template_id: null });
        } else {
          messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: '[Erro na geração]', approved: false, template_status: 'APPROVED', suggested_template_id: null });
        }
      } catch (e) {
        messagesPreview.push({ deal_id: deal.id, contact_name: contactName, message: `[Erro: ${e instanceof Error ? e.message : 'unknown'}]`, approved: false, template_status: 'APPROVED', suggested_template_id: null });
      }
    }

    const finalStatus = hasPendingTemplates ? 'AGUARDANDO_TEMPLATE' : 'PREVIEW';
    await supabase.from('mass_action_jobs').update({ status: finalStatus, messages_preview: messagesPreview, processed: messagesPreview.length }).eq('id', jobId);
    return new Response(JSON.stringify({ ok: true, count: messagesPreview.length, hasPendingTemplates }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    log.error('Error', { error: e instanceof Error ? e.message : 'Unknown error' });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
