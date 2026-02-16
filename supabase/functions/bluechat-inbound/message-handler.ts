// ========================================
// bluechat-inbound/message-handler.ts — Salvar mensagens inbound
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import type { EmpresaTipo } from "../_shared/types.ts";
import type { BlueChatPayload, LeadContact, LeadCadenceRun } from "./types.ts";
import { isDuplicate } from "./contact-resolver.ts";

const log = createLogger('bluechat-inbound');

/**
 * Salva mensagem inbound
 */
export async function saveInboundMessage(
  supabase: SupabaseClient,
  payload: BlueChatPayload,
  leadContact: LeadContact,
  activeRun: LeadCadenceRun | null,
  empresaContexto: EmpresaTipo
): Promise<{ messageId: string } | null> {
  // Verificar duplicata
  if (await isDuplicate(supabase, payload.message_id)) {
    log.info('Mensagem duplicada', { messageId: payload.message_id });
    return null;
  }

  // IMPORTANTE: Usa empresaContexto (do payload) em vez de leadContact.empresa
  // para garantir isolamento de contexto entre empresas
  const messageRecord = {
    lead_id: leadContact.lead_id,
    empresa: empresaContexto,
    run_id: activeRun?.id || null,
    canal: payload.channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
    direcao: 'INBOUND',
    conteudo: payload.message.text,
    estado: 'RECEBIDO',
    whatsapp_message_id: payload.message_id,
    recebido_em: payload.timestamp,
  };

  log.info('Salvando mensagem', {
    leadId: messageRecord.lead_id,
    runId: messageRecord.run_id,
    canal: messageRecord.canal,
  });

  const { data, error } = await supabase
    .from('lead_messages')
    .insert(messageRecord)
    .select('id')
    .single();

  if (error) {
    log.error('Erro ao salvar mensagem', { error: error.message });
    return null;
  }

  const savedMessage = { messageId: (data as { id: string }).id };
  log.info('Mensagem salva', { messageId: savedMessage.messageId });

  // Registrar evento de resposta se tiver run ativa
  if (activeRun) {
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: activeRun.id,
      step_ordem: 0,
      template_codigo: 'BLUECHAT_INBOUND',
      tipo_evento: 'RESPOSTA_DETECTADA',
      detalhes: {
        message_id: savedMessage.messageId,
        bluechat_message_id: payload.message_id,
        conversation_id: payload.conversation_id,
        preview: payload.message.text.substring(0, 100),
      },
    });
  }

  return savedMessage;
}
