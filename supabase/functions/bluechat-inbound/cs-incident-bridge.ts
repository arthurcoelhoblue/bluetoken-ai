// cs-incident-bridge.ts — Auto-criação de incidências CS a partir de conversas Blue Chat
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('cs-incident-bridge');

interface CSIncidentParams {
  leadId: string;
  empresa: string;
  resolution?: { summary: string; reason: string };
  isEscalate?: boolean;
}

/**
 * Verifica se o lead é um cliente CS e, se for, cria uma incidência
 * com resumo da conversa gerado pela IA.
 * 
 * Chamado após RESOLVE (incidência RESOLVIDA → trigger CSAT automático)
 * e após ESCALATE (incidência ABERTA).
 */
export async function maybeCreateCSIncident(
  supabase: SupabaseClient,
  params: CSIncidentParams
): Promise<void> {
  const { leadId, empresa, resolution, isEscalate } = params;

  try {
    // 1. Buscar contact CRM via legacy_lead_id
    const { data: crmContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('legacy_lead_id', leadId)
      .eq('empresa', empresa)
      .maybeSingle();

    if (!crmContact) {
      log.info('Contact CRM não encontrado, ignorando CS bridge', { leadId });
      return;
    }

    // 2. Buscar cs_customer
    const { data: csCustomer } = await supabase
      .from('cs_customers')
      .select('id')
      .eq('contact_id', crmContact.id)
      .eq('empresa', empresa)
      .maybeSingle();

    if (!csCustomer) {
      log.info('Não é cliente CS, ignorando', { contactId: crmContact.id });
      return;
    }

    log.info('Cliente CS detectado, criando incidência', { customerId: csCustomer.id, isEscalate });

    // 3. Buscar últimas mensagens da conversa
    const { data: messages } = await supabase
      .from('lead_messages')
      .select('direcao, conteudo, created_at')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!messages || messages.length === 0) {
      log.warn('Sem mensagens para gerar resumo');
      return;
    }

    // 4. Montar texto da conversa para a IA
    const conversationText = messages
      .map(m => `[${m.direcao === 'INBOUND' ? 'CLIENTE' : 'ATENDENTE'}]: ${m.conteudo}`)
      .join('\n');

    // 5. Classificar via IA
    const aiResult = await callAI({
      system: `Você é uma analista de Customer Success. Analise a conversa abaixo entre um cliente e a equipe. Classifique:
1. tipo: RECLAMACAO | SOLICITACAO | INSATISFACAO | OUTRO
2. gravidade: BAIXA | MEDIA | ALTA | CRITICA
3. titulo: resumo em 1 frase (max 80 chars)
4. descricao: resumo completo do que foi tratado, decisões tomadas e próximos passos

Responda APENAS em JSON válido: { "tipo": "...", "gravidade": "...", "titulo": "...", "descricao": "..." }`,
      prompt: conversationText,
      functionName: 'cs-incident-bridge',
      empresa,
      temperature: 0.2,
      maxTokens: 800,
      supabase,
    });

    if (!aiResult.content) {
      log.warn('IA não retornou conteúdo para classificação');
      // Fallback: criar com dados mínimos
      await insertIncident(supabase, {
        customerId: csCustomer.id,
        empresa,
        tipo: isEscalate ? 'SOLICITACAO' : 'OUTRO',
        gravidade: isEscalate ? 'MEDIA' : 'BAIXA',
        titulo: resolution?.summary?.substring(0, 80) || 'Conversa via Blue Chat',
        descricao: resolution?.summary || `Conversa com ${messages.length} mensagens registrada automaticamente.`,
        isResolved: !isEscalate,
      });
      return;
    }

    // 6. Parsear resposta da IA
    let classification: { tipo: string; gravidade: string; titulo: string; descricao: string };
    try {
      const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
      classification = JSON.parse(jsonMatch?.[0] || aiResult.content);
    } catch {
      log.warn('Falha ao parsear JSON da IA, usando fallback');
      classification = {
        tipo: isEscalate ? 'SOLICITACAO' : 'OUTRO',
        gravidade: 'BAIXA',
        titulo: resolution?.summary?.substring(0, 80) || 'Conversa via Blue Chat',
        descricao: aiResult.content,
      };
    }

    // Validar valores
    const tiposValidos = ['RECLAMACAO', 'SOLICITACAO', 'INSATISFACAO', 'OUTRO'];
    const gravidadesValidas = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

    const tipo = tiposValidos.includes(classification.tipo) ? classification.tipo : 'OUTRO';
    const gravidade = gravidadesValidas.includes(classification.gravidade) ? classification.gravidade : 'BAIXA';

    // 7. Inserir incidência
    await insertIncident(supabase, {
      customerId: csCustomer.id,
      empresa,
      tipo,
      gravidade,
      titulo: (classification.titulo || 'Conversa Blue Chat').substring(0, 80),
      descricao: classification.descricao || resolution?.summary || '',
      isResolved: !isEscalate,
    });

    log.info('Incidência CS criada com sucesso', {
      customerId: csCustomer.id,
      tipo,
      gravidade,
      isResolved: !isEscalate,
    });
  } catch (err) {
    log.error('Erro ao criar incidência CS', {
      error: err instanceof Error ? err.message : String(err),
      leadId,
    });
  }
}

async function insertIncident(
  supabase: SupabaseClient,
  params: {
    customerId: string;
    empresa: string;
    tipo: string;
    gravidade: string;
    titulo: string;
    descricao: string;
    isResolved: boolean;
  }
): Promise<void> {
  const { error } = await supabase.from('cs_incidents').insert({
    customer_id: params.customerId,
    empresa: params.empresa,
    tipo: params.tipo,
    gravidade: params.gravidade,
    titulo: params.titulo,
    descricao: params.descricao,
    origem: 'BLUECHAT',
    status: params.isResolved ? 'RESOLVIDA' : 'ABERTA',
    resolved_at: params.isResolved ? new Date().toISOString() : null,
    detectado_por_ia: true,
  });

  if (error) {
    log.error('Erro ao inserir cs_incidents', { error: error.message });
    throw error;
  }
}
