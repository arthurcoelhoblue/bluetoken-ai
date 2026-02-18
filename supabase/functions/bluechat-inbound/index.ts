// ========================================
// bluechat-inbound/index.ts — Orquestrador
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import type { EmpresaTipo, Temperatura, TipoLead } from "../_shared/types.ts";
import { mapBluechatEmpresa } from "../_shared/empresa-mapping.ts";
import { resolveTargetPipeline, findExistingDealForPerson } from "../_shared/pipeline-routing.ts";
import { checkWebhookRateLimit, rateLimitResponse } from "../_shared/webhook-rate-limit.ts";

import type { BlueChatPayload, BlueChatResponse, LeadContact } from "./types.ts";
import { blueChatSchema } from "./schemas.ts";
import { validateAuth } from "./auth.ts";
import { normalizePhone, extractFirstName, findLeadByPhone, createLead } from "./contact-resolver.ts";
import { parseTriageSummary, enrichLeadFromTriage } from "./triage.ts";
import { saveInboundMessage } from "./message-handler.ts";
import { callSdrIaInterpret } from "./sdr-bridge.ts";
import { sendResponseToBluechat } from "./callback.ts";

const corsHeaders = getWebhookCorsHeaders("x-api-key");
const log = createLogger('bluechat-inbound');

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validar autenticação
  const authResult = validateAuth(req);
  if (!authResult.valid) {
    log.error('Acesso não autorizado');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const rawPayload = await req.json();

    // Zod validation
    const parsed = blueChatSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload', details: parsed.error.errors[0]?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const payload: BlueChatPayload = parsed.data as BlueChatPayload;

    log.info('Webhook recebido', {
      conversation_id: payload.conversation_id,
      ticket_id: payload.ticket_id,
      message_id: payload.message_id,
      channel: payload.channel,
      phone: payload.contact?.phone,
      textPreview: payload.message?.text?.substring(0, 50),
    });

    const supabase = createServiceClient();

    // Rate limiting (150 req/min per empresa)
    const empresa: EmpresaTipo = mapBluechatEmpresa(payload.context?.empresa);
    const rateCheck = await checkWebhookRateLimit(supabase, 'bluechat-inbound', empresa, 150);
    if (!rateCheck.allowed) {
      log.warn('Rate limit exceeded', { count: rateCheck.currentCount });
      return rateLimitResponse(corsHeaders);
    }

    const phoneInfo = normalizePhone(payload.contact.phone);
    log.info('Empresa determinada', { empresa, rawEmpresa: payload.context?.empresa });

    // Verificar se bluechat está habilitado para esta empresa
    const { data: channelConfig } = await supabase
      .from('integration_company_config')
      .select('enabled')
      .eq('empresa', empresa)
      .eq('channel', 'bluechat')
      .maybeSingle();

    if (!channelConfig?.enabled) {
      log.info(`Canal bluechat desabilitado para empresa ${empresa}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Blue Chat não está habilitado para ${empresa}`,
          conversation_id: payload.conversation_id,
          action: 'ESCALATE',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicação por conteúdo (mesma mensagem nos últimos 30s)
    {
      const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
      const { data: recentDup } = await supabase
        .from('lead_messages')
        .select('id')
        .eq('conteudo', payload.message.text)
        .gte('created_at', thirtySecsAgo)
        .limit(1)
        .maybeSingle();

      if (recentDup) {
        log.info('Mensagem duplicada detectada (mesmo conteúdo em <30s)');
        return new Response(
          JSON.stringify({
            success: true,
            conversation_id: payload.conversation_id,
            action: 'QUALIFY_ONLY',
            deduplicated: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1. Buscar lead existente
    let leadContact = await findLeadByPhone(supabase, phoneInfo.normalized, phoneInfo.e164, empresa);

    // 2. Criar lead se não existir
    if (!leadContact) {
      log.info('Lead não encontrado, criando novo...');
      leadContact = await createLead(supabase, payload, phoneInfo, empresa);

      if (!leadContact) {
        const errorResponse: BlueChatResponse = {
          success: false,
          conversation_id: payload.conversation_id,
          action: 'ESCALATE',
          escalation: { needed: true, reason: 'Erro ao criar lead', priority: 'HIGH' },
          error: 'Failed to create lead',
        };
        return new Response(
          JSON.stringify(errorResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se lead foi encontrado em empresa diferente, criar lead_contacts espelho
    if (leadContact.empresa !== empresa) {
      log.warn('Lead encontrado em outra empresa, criando registro espelho', {
        leadEmpresa: leadContact.empresa,
        payloadEmpresa: empresa,
        leadId: leadContact.lead_id,
      });

      const { data: existingContact } = await supabase
        .from('lead_contacts')
        .select('id')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();

      if (!existingContact) {
        const mirrorContact = {
          id: crypto.randomUUID(),
          lead_id: leadContact.lead_id,
          empresa,
          nome: leadContact.nome || payload.contact.name || null,
          primeiro_nome: extractFirstName(leadContact.nome || payload.contact.name),
          email: leadContact.email || payload.contact.email || null,
          telefone: leadContact.telefone,
          telefone_e164: leadContact.telefone_e164,
          telefone_valido: true,
          ddi: '55',
          origem_telefone: 'BLUECHAT',
          opt_out: false,
          pessoa_id: (leadContact as Record<string, unknown>).pessoa_id as string | null || null,
        };

        const { data: newContact, error: mirrorErr } = await supabase
          .from('lead_contacts')
          .insert(mirrorContact)
          .select()
          .single();

        if (mirrorErr) {
          log.error('Erro ao criar lead_contacts espelho', { error: mirrorErr.message });
        } else {
          log.info('Lead_contacts espelho criado', { empresa });
          leadContact = newContact as LeadContact;
        }

        const defaultIcp = empresa === 'BLUE' ? 'BLUE_NAO_CLASSIFICADO'
          : empresa === 'MPUPPE' ? 'MPUPPE_NAO_CLASSIFICADO'
          : empresa === 'AXIA' ? 'AXIA_NAO_CLASSIFICADO'
          : 'TOKENIZA_NAO_CLASSIFICADO';
        await supabase.from('lead_classifications').insert({
          lead_id: leadContact.lead_id,
          empresa,
          icp: defaultIcp,
          temperatura: 'MORNO',
          prioridade: 2,
          origem: 'AUTOMATICA',
        });
      } else {
        const { data: correctContact } = await supabase
          .from('lead_contacts')
          .select('*')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .single();
        if (correctContact) {
          leadContact = correctContact as LeadContact;
        }
      }
    }

    // ========================================
    // AUTO-CRIAÇÃO DE DEAL (Roteamento + Dedup)
    // ========================================
    try {
      const { data: crmContact } = await supabase
        .from('contacts')
        .select('id, telefone_e164, email, cpf, nome')
        .eq('legacy_lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();

      if (crmContact) {
        const duplicateMatch = await findExistingDealForPerson(supabase, empresa, {
          telefone_e164: crmContact.telefone_e164 || leadContact.telefone_e164,
          telefone: leadContact.telefone,
          email: crmContact.email || leadContact.email || payload.contact.email,
          cpf: crmContact.cpf,
        });

        if (duplicateMatch) {
          log.info('Duplicata detectada, deal existente', { dealId: duplicateMatch.dealId });
          const enrichUpdates: Record<string, unknown> = {};
          if (payload.contact.email && !crmContact.email) enrichUpdates.email = payload.contact.email;
          if (payload.contact.name && !crmContact.nome) enrichUpdates.nome = payload.contact.name;
          if (Object.keys(enrichUpdates).length > 0) {
            await supabase.from('contacts').update(enrichUpdates).eq('id', duplicateMatch.contactId);
          }
        } else {
          const tipoLead = (payload.context?.tipo_lead as TipoLead) || 'INVESTIDOR';
          const { data: leadClassif } = await supabase
            .from('lead_classifications')
            .select('temperatura')
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const temperatura: Temperatura = (leadClassif?.temperatura as Temperatura) || 'MORNO';
          const routing = resolveTargetPipeline(empresa, tipoLead, temperatura, false);
          const dealTitulo = `${leadContact.nome || payload.contact.name || 'Lead'} — Blue Chat`;

          const { data: newDeal, error: dealError } = await supabase
            .from('deals')
            .insert({
              contact_id: crmContact.id,
              pipeline_id: routing.pipelineId,
              stage_id: routing.stageId,
              titulo: dealTitulo,
              valor: 0,
              moeda: 'BRL',
              temperatura,
              status: 'ABERTO',
              origem: 'BLUECHAT',
            } as Record<string, unknown>)
            .select('id')
            .single();

          if (dealError) {
            log.error('Erro ao criar deal', { error: dealError.message });
          } else {
            log.info('Deal criado', { dealId: newDeal.id, pipeline: routing.pipelineId });
            await supabase.from('deal_activities').insert({
              deal_id: newDeal.id,
              tipo: 'CRIACAO',
              descricao: `Deal criado via Blue Chat (${temperatura})`,
              metadata: { origem: 'BLUECHAT', temperatura, tipo_lead: tipoLead },
            } as Record<string, unknown>);

            if (temperatura === 'QUENTE') {
              const { data: adminRoles } = await supabase
                .from('user_roles')
                .select('user_id')
                .in('role', ['ADMIN', 'CLOSER'])
                .limit(10);
              for (const admin of adminRoles ?? []) {
                await supabase.from('notifications').insert({
                  user_id: admin.user_id,
                  tipo: 'DEAL_NOVO_PRIORITARIO',
                  titulo: '🔥 Lead QUENTE entrou pelo Blue Chat!',
                  mensagem: `${leadContact.nome || payload.contact.name} — ${empresa}`,
                  empresa,
                  link: `/pipeline?deal=${newDeal.id}`,
                  entity_id: newDeal.id,
                  entity_type: 'deal',
                  metadata: { deal_id: newDeal.id, temperatura },
                } as Record<string, unknown>);
              }
            }
          }
        }
      } else {
        log.info('Contact CRM não encontrado para lead', { leadId: leadContact.lead_id });
      }
    } catch (dealErr) {
      log.error('Erro no fluxo de auto-criação de deal', { error: dealErr instanceof Error ? dealErr.message : String(dealErr) });
    }

    // 3. Detectar resumo de triagem [NOVO ATENDIMENTO]
    const triageSummary = parseTriageSummary(payload.message.text);

    // Verificar se é lead retornando (interação recente < 2h)
    let isReturningLead = false;
    if (triageSummary) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentInteraction } = await supabase
        .from('lead_messages')
        .select('id')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .gte('created_at', twoHoursAgo)
        .limit(1)
        .maybeSingle();

      if (recentInteraction) {
        isReturningLead = true;
        log.info('Lead retornando detectado (interação < 2h)');
      }
    }

    // 3.1 Se é resumo de triagem, enriquecer lead com dados extraídos
    if (triageSummary && !isReturningLead) {
      log.info('Resumo de triagem detectado para lead', { leadId: leadContact.lead_id });
      await enrichLeadFromTriage(supabase, leadContact, triageSummary);

      // Reset de estado ESCALAR_IMEDIATO no [NOVO ATENDIMENTO]
      try {
        const { data: convStateForReset } = await supabase
          .from('lead_conversation_state')
          .select('ultima_pergunta_id, estado_funil, framework_data')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .maybeSingle();

        if (convStateForReset) {
          const needsReset =
            convStateForReset.ultima_pergunta_id === 'ESCALAR_IMEDIATO' ||
            convStateForReset.estado_funil === 'ESCALAR_IMEDIATO' ||
            ['POS_VENDA', 'FECHAMENTO'].includes(convStateForReset.estado_funil || '');

          if (needsReset) {
            const fwData = (convStateForReset.framework_data as Record<string, unknown>) || {};
            await supabase
              .from('lead_conversation_state')
              .update({
                ultima_pergunta_id: 'NENHUMA',
                estado_funil: 'DIAGNOSTICO',
                framework_data: { ...fwData, ia_null_count: 0, ticket_resolved: false },
                updated_at: new Date().toISOString(),
              })
              .eq('lead_id', leadContact.lead_id)
              .eq('empresa', empresa);
            log.info('Estado ESCALAR_IMEDIATO/terminal resetado para novo atendimento');
          }
        }
      } catch (resetErr) {
        log.error('Erro ao resetar estado', { error: resetErr instanceof Error ? resetErr.message : String(resetErr) });
      }
    } else if (triageSummary && isReturningLead) {
      log.info('Lead retornando - NÃO tratando como novo atendimento');
    }

    // 4. Modo passivo: NÃO buscar cadência ativa
    const activeRun = null;

    // 5. Salvar mensagem (sem cadência vinculada)
    const savedMessage = await saveInboundMessage(supabase, payload, leadContact, activeRun, empresa);

    if (!savedMessage) {
      const duplicateResponse: BlueChatResponse = {
        success: true,
        conversation_id: payload.conversation_id,
        message_id: payload.message_id,
        lead_id: leadContact.lead_id,
        action: 'QUALIFY_ONLY',
        response: { text: '', suggested_next: 'Mensagem já processada anteriormente' },
        intent: { detected: 'DUPLICATE', confidence: 1, lead_ready: false },
        escalation: { needed: false },
      };
      return new Response(
        JSON.stringify(duplicateResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Chamar SDR IA para interpretar
    const iaResult = await callSdrIaInterpret(savedMessage.messageId, triageSummary);

    // Detectar intenção de encerramento da conversa
    const closingKeywords = ['obrigado', 'obrigada', 'valeu', 'até mais', 'tchau', 'era isso', 'resolvido', 'era só isso', 'muito obrigado', 'muito obrigada', 'falou', 'flw', 'vlw', 'brigado', 'brigada'];
    const closingIntents = ['AGRADECIMENTO', 'CUMPRIMENTO'];
    const messageText = payload.message.text.toLowerCase().trim();

    const isClosingIntent = closingIntents.includes(iaResult?.intent || '');
    const hasClosingKeyword = closingKeywords.some(kw => messageText.includes(kw));

    // Proteção contra agradecimento à MarIA
    let ameliaOutboundCount = 0;
    if (isClosingIntent || hasClosingKeyword) {
      const { count } = await supabase
        .from('lead_messages')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .eq('direcao', 'OUTBOUND')
        .eq('sender_type', 'AMELIA');
      ameliaOutboundCount = count || 0;
    }

    const isThankingMarIA = (triageSummary || ameliaOutboundCount < 3) && (isClosingIntent || hasClosingKeyword);
    if (isThankingMarIA) {
      log.info('Agradecimento detectado mas Amélia tem <3 OUTBOUND ou triageSummary → NÃO tratando como encerramento');
    }

    // Verificar estado do funil para contexto de encerramento
    let funnelClosing = false;
    if (iaResult && (isClosingIntent || hasClosingKeyword) && !isThankingMarIA) {
      const { data: convState } = await supabase
        .from('lead_conversation_state')
        .select('estado_funil')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();
      funnelClosing = ['POS_VENDA', 'FECHAMENTO'].includes(convState?.estado_funil || '');
    }

    const isConversationEnding = !isThankingMarIA && isClosingIntent && (hasClosingKeyword || funnelClosing);

    let resolution: { summary: string; reason: string } | undefined;
    if (isConversationEnding) {
      const leadName = leadContact.nome || payload.contact.name || 'Lead';
      resolution = {
        summary: `Atendimento de ${leadName} (${empresa}) concluído. Intent: ${iaResult?.intent || 'N/A'}. Qualificação via Amélia SDR.`,
        reason: `Lead encerrou a conversa (${iaResult?.intent || 'despedida'}). Palavra-chave detectada na mensagem.`,
      };
      log.info('Encerramento detectado', { resolution });
    }

    // 7. ANTI-LIMBO: Determinar ação e mensagem
    let action: BlueChatResponse['action'];
    let responseText: string | null = iaResult?.responseText || null;
    let departamentoDestino: string = iaResult?.departamento_destino || 'Comercial';

    if (!iaResult) {
      // IA retornou null (falha total)
      const { data: stateForNull } = await supabase
        .from('lead_conversation_state')
        .select('framework_data')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();

      const fwData = (stateForNull?.framework_data as Record<string, unknown>) || {};
      const iaNullCount = (typeof fwData.ia_null_count === 'number' ? fwData.ia_null_count : 0) + 1;

      if (iaNullCount >= 3) {
        action = 'ESCALATE';
        responseText = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
        departamentoDestino = 'Comercial';
        log.info(`IA null ${iaNullCount}x consecutivas → ESCALATE`);
        await supabase
          .from('lead_conversation_state')
          .update({ framework_data: { ...fwData, ia_null_count: 0 } })
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa);
      } else {
        action = 'RESPOND';
        responseText = 'Desculpa, pode repetir ou dar mais detalhes? Quero entender direitinho pra te ajudar!';
        log.info(`IA null (${iaNullCount}/3) → pergunta de continuidade`);
        await supabase
          .from('lead_conversation_state')
          .update({ framework_data: { ...fwData, ia_null_count: iaNullCount } })
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa);
      }
    } else if (isConversationEnding) {
      // Resetar contador de falhas
      try {
        const { data: stateForReset } = await supabase
          .from('lead_conversation_state')
          .select('framework_data')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .maybeSingle();
        const fwReset = (stateForReset?.framework_data as Record<string, unknown>) || {};
        if (fwReset.ia_null_count && (fwReset.ia_null_count as number) > 0) {
          await supabase
            .from('lead_conversation_state')
            .update({ framework_data: { ...fwReset, ia_null_count: 0 } })
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa);
        }
      } catch (_) { /* non-critical */ }
      action = 'RESOLVE';
    } else if (iaResult.escalation?.needed) {
      action = 'ESCALATE';
      if (!responseText) {
        responseText = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
        log.info('ESCALATE sem responseText → mensagem padrão');
      }
    } else if (responseText) {
      action = 'RESPOND';
      // Resetar contador de falhas
      try {
        const { data: stateForReset2 } = await supabase
          .from('lead_conversation_state')
          .select('framework_data')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .maybeSingle();
        const fwReset2 = (stateForReset2?.framework_data as Record<string, unknown>) || {};
        if (fwReset2.ia_null_count && (fwReset2.ia_null_count as number) > 0) {
          await supabase
            .from('lead_conversation_state')
            .update({ framework_data: { ...fwReset2, ia_null_count: 0 } })
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa);
        }
      } catch (_) { /* non-critical */ }
    } else {
      // ANTI-LIMBO: IA respondeu mas sem texto
      const { count: msgCount } = await supabase
        .from('lead_messages')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa);

      if ((msgCount || 0) <= 2) {
        action = 'RESPOND';
        responseText = 'Oi! Sou a Amélia, do comercial do Grupo Blue. Em que posso te ajudar?';
        log.info('Sem resposta IA + pouco contexto → pergunta de contexto');
      } else if ((msgCount || 0) > 15) {
        action = 'ESCALATE';
        departamentoDestino = 'Comercial';
        responseText = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
        log.info('Sem resposta IA + >15 msgs → ESCALATE (loop detectado)');
      } else {
        action = 'RESPOND';
        responseText = 'Me conta mais sobre o que você precisa? Quero entender melhor pra te direcionar certo!';
        log.info('Sem resposta IA + contexto médio → pergunta de continuidade');
      }
    }

    const response: BlueChatResponse = {
      success: true,
      conversation_id: payload.conversation_id,
      message_id: savedMessage.messageId,
      lead_id: leadContact.lead_id,
      action,
      intent: {
        detected: iaResult?.intent || 'OUTRO',
        confidence: iaResult?.confidence || 0.5,
        lead_ready: iaResult?.leadReady || false,
      },
      escalation: {
        needed: action === 'ESCALATE',
        reason: iaResult?.escalation?.reason || (action === 'ESCALATE' ? 'Escalação automática anti-limbo' : undefined),
        priority: (iaResult?.escalation?.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || (action === 'ESCALATE' ? 'MEDIUM' : undefined),
        department: action === 'ESCALATE' ? departamentoDestino : undefined,
      },
    };

    if (resolution) {
      response.resolution = resolution;
    }

    if (responseText) {
      response.response = {
        text: responseText,
        suggested_next: isConversationEnding
          ? 'Conversa encerrada - ticket resolvido'
          : action === 'ESCALATE'
            ? 'Ticket transferido para atendimento humano'
            : iaResult?.leadReady
              ? 'Lead pronto para closer - agendar reunião'
              : 'Continuar qualificação',
      };
    }

    // 7.5. Persistir conversation_id do Blue Chat no lead_conversation_state
    try {
      const { data: existingState } = await supabase
        .from('lead_conversation_state')
        .select('framework_data')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();

      const currentFrameworkData = (existingState?.framework_data as Record<string, unknown>) || {};
      const updatedFrameworkData = {
        ...currentFrameworkData,
        bluechat_conversation_id: payload.conversation_id,
        bluechat_ticket_id: payload.ticket_id || null,
      };

      await supabase
        .from('lead_conversation_state')
        .upsert({
          lead_id: leadContact.lead_id,
          empresa: empresa,
          framework_data: updatedFrameworkData,
          ultimo_contato_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'lead_id,empresa' });

      log.info('conversation_id salvo no framework_data', { conversationId: payload.conversation_id });
    } catch (err) {
      log.error('Erro ao salvar conversation_id', { error: err instanceof Error ? err.message : String(err) });
    }

    // 8. Persistir mensagem OUTBOUND da Amélia no banco
    if (responseText) {
      try {
        const { data: outboundMsg, error: outboundError } = await supabase
          .from('lead_messages')
          .insert({
            lead_id: leadContact.lead_id,
            empresa: empresa,
            canal: payload.channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
            direcao: 'OUTBOUND',
            conteudo: responseText,
            estado: 'ENVIADO',
            template_codigo: 'BLUECHAT_PASSIVE_REPLY',
            enviado_em: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (outboundError) {
          log.error('Erro ao persistir mensagem OUTBOUND', { error: outboundError.message });
        } else {
          log.info('Mensagem OUTBOUND persistida', { messageId: (outboundMsg as { id: string }).id });
        }
      } catch (err) {
        log.error('Erro inesperado ao persistir OUTBOUND', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Verificar ticket resolvido antes de enviar callback
    let ticketAlreadyResolved = false;
    try {
      const { data: stateForTicket } = await supabase
        .from('lead_conversation_state')
        .select('framework_data')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();
      const fwTicket = (stateForTicket?.framework_data as Record<string, unknown>) || {};
      ticketAlreadyResolved = fwTicket.ticket_resolved === true;
    } catch (_) { /* non-critical */ }

    if (ticketAlreadyResolved) {
      log.info('Ticket já resolvido, Amélia ficando muda');
      response.action = 'QUALIFY_ONLY';
    }

    // 9. Callback: enviar resposta/escalação de volta ao Blue Chat
    if (responseText && !ticketAlreadyResolved) {
      await sendResponseToBluechat(supabase, {
        conversation_id: payload.conversation_id,
        ticket_id: payload.ticket_id,
        message_id: savedMessage.messageId,
        text: responseText,
        action: response.action,
        resolution,
        empresa,
        department: action === 'ESCALATE' ? departamentoDestino : undefined,
      });

      // Se ação é RESOLVE, marcar ticket_resolved no framework_data
      if (response.action === 'RESOLVE') {
        try {
          const { data: stateForResolve } = await supabase
            .from('lead_conversation_state')
            .select('framework_data')
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa)
            .maybeSingle();
          const fwResolve = (stateForResolve?.framework_data as Record<string, unknown>) || {};
          await supabase
            .from('lead_conversation_state')
            .update({ framework_data: { ...fwResolve, ticket_resolved: true } })
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa);
          log.info('Flag ticket_resolved setada');
        } catch (_) { /* non-critical */ }
      }
    }

    log.info('Resposta final', {
      action: response.action,
      intent: response.intent?.detected,
      leadReady: response.intent?.lead_ready,
      hasResponse: !!response.response?.text,
    });

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log.error('Erro geral', { error: error instanceof Error ? error.message : String(error) });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
