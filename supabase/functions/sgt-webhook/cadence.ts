// ========================================
// sgt-webhook/cadence.ts — Motor de cadências
// Extraído do index.ts (Fase D)
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isHorarioComercial, proximoHorarioComercial } from "../_shared/business-hours.ts";
import { createLogger } from "../_shared/logger.ts";
import type {
  EmpresaTipo, SGTEventoTipo, CadenceCodigo,
  LeadClassificationResult,
} from "./types.ts";

const log = createLogger('sgt-webhook/cadence');

// ========================================
// DECISÃO DE CADÊNCIA
// ========================================
export function decidirCadenciaParaLead(
  classification: LeadClassificationResult,
  evento: SGTEventoTipo
): CadenceCodigo | null {
  const { empresa, icp, temperatura } = classification;

  log.info('Decidindo cadência', { empresa, icp, temperatura, evento });

  if (empresa === 'TOKENIZA') {
    if ((evento === 'MQL' || evento === 'CARRINHO_ABANDONADO') && temperatura === 'QUENTE') {
      return 'TOKENIZA_MQL_QUENTE';
    }
    if (evento === 'LEAD_NOVO') {
      return 'TOKENIZA_INBOUND_LEAD_NOVO';
    }
  }

  if (empresa === 'BLUE') {
    if (icp === 'BLUE_ALTO_TICKET_IR' || 
        (icp === 'BLUE_RECURRENTE' && evento === 'MQL')) {
      return 'BLUE_IR_URGENTE';
    }
    if (evento === 'LEAD_NOVO') {
      return 'BLUE_INBOUND_LEAD_NOVO';
    }
  }

  log.debug('Nenhuma cadência aplicável para este evento');
  return null;
}

// ========================================
// INÍCIO DE CADÊNCIA
// ========================================
export async function iniciarCadenciaParaLead(
  supabase: SupabaseClient,
  leadId: string,
  empresa: EmpresaTipo,
  cadenceCodigo: CadenceCodigo,
  classification: LeadClassificationResult,
  fonteEventoId: string
): Promise<{ success: boolean; runId?: string; skipped?: boolean; reason?: string }> {
  log.info('Iniciando cadência', { leadId, empresa, cadenceCodigo });

  // Validação: verificar canal de contato válido
  const { data: leadContact, error: contactError } = await supabase
    .from('lead_contacts')
    .select('telefone, telefone_valido, telefone_e164, email, email_placeholder')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .maybeSingle();

  if (contactError) {
    log.error('Erro ao buscar lead_contact', { error: contactError.message });
  }

  if (leadContact) {
    const temTelefoneValido = leadContact.telefone_valido && leadContact.telefone_e164;
    const temEmailValido = leadContact.email && !leadContact.email_placeholder;
    
    if (!temTelefoneValido && !temEmailValido) {
      log.info('Lead sem canal de contato válido, não iniciando cadência', {
        leadId, telefone: leadContact.telefone, telefone_valido: leadContact.telefone_valido,
        email: leadContact.email, email_placeholder: leadContact.email_placeholder
      });
      return { 
        success: false, skipped: true, 
        reason: 'Lead sem canal de contato válido (telefone inválido e email placeholder/ausente)' 
      };
    }
  }

  const { data: cadence, error: cadenceError } = await supabase
    .from('cadences')
    .select('id, codigo, nome')
    .eq('codigo', cadenceCodigo)
    .eq('ativo', true)
    .single();

  if (cadenceError || !cadence) {
    log.error('Cadência não encontrada', { cadenceCodigo });
    return { success: false, reason: `Cadência ${cadenceCodigo} não encontrada ou inativa` };
  }

  const { data: existingRun } = await supabase
    .from('lead_cadence_runs')
    .select('id, status')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .eq('status', 'ATIVA')
    .maybeSingle();

  if (existingRun) {
    log.info('Lead já possui cadência ativa', { runId: existingRun.id });
    return { success: true, skipped: true, reason: 'Lead já possui cadência ativa', runId: existingRun.id };
  }

  const { data: firstStep, error: stepError } = await supabase
    .from('cadence_steps')
    .select('ordem, offset_minutos, template_codigo')
    .eq('cadence_id', cadence.id)
    .order('ordem', { ascending: true })
    .limit(1)
    .single();

  if (stepError || !firstStep) {
    log.error('Nenhum step encontrado para cadência', { cadenceCodigo });
    return { success: false, reason: 'Nenhum step configurado para esta cadência' };
  }

  const now = new Date();
  let nextRunAt = new Date(now.getTime() + firstStep.offset_minutos * 60 * 1000);
  
  if (!isHorarioComercial()) {
    const proximoHorario = proximoHorarioComercial();
    if (proximoHorario.getTime() > nextRunAt.getTime()) {
      nextRunAt = proximoHorario;
    }
    log.info('Fora de horário comercial, agendando para', { nextRunAt: nextRunAt.toISOString() });
  }

  const { data: newRun, error: runError } = await supabase
    .from('lead_cadence_runs')
    .insert({
      lead_id: leadId, empresa, cadence_id: cadence.id,
      status: 'ATIVA', started_at: now.toISOString(),
      last_step_ordem: 0, next_step_ordem: firstStep.ordem,
      next_run_at: nextRunAt.toISOString(),
      classification_snapshot: classification as unknown as Record<string, unknown>,
      fonte_evento_id: fonteEventoId,
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (runError || !newRun) {
    log.error('Erro ao criar run', { error: runError?.message });
    return { success: false, reason: 'Erro ao criar run de cadência' };
  }

  log.info('Run criado', { runId: newRun.id });

  await supabase.from('lead_cadence_events').insert({
    lead_cadence_run_id: newRun.id,
    step_ordem: firstStep.ordem,
    template_codigo: firstStep.template_codigo,
    tipo_evento: 'AGENDADO',
    detalhes: {
      next_run_at: nextRunAt.toISOString(),
      cadence_codigo: cadenceCodigo,
      cadence_nome: cadence.nome,
    },
  } as Record<string, unknown>);

  log.debug('Evento AGENDADO criado', { step: firstStep.ordem });

  return { success: true, runId: newRun.id };
}
