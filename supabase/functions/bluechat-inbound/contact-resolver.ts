// ========================================
// bluechat-inbound/contact-resolver.ts — Busca e criação de leads
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import type { EmpresaTipo } from "../_shared/types.ts";
import type { BlueChatPayload, LeadContact, LeadCadenceRun } from "./types.ts";

const log = createLogger('bluechat-inbound');

/**
 * Normaliza número de telefone para formato E.164 (versão simples local)
 */
export function normalizePhone(raw: string): { normalized: string; e164: string } {
  let normalized = raw.replace(/\D/g, '');
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  }
  const e164 = normalized.startsWith('+') ? normalized : `+${normalized}`;
  return { normalized, e164 };
}

/**
 * Extrai primeiro nome do nome completo
 */
export function extractFirstName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const parts = fullName.trim().split(' ');
  return parts[0] || null;
}

/**
 * Gera variações do telefone para busca no campo 'telefone' (sem prefixo +)
 */
export function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [phone];
  const withoutDDI = phone.startsWith('55') ? phone.slice(2) : phone;
  const ddd = withoutDDI.slice(0, 2);
  const number = withoutDDI.slice(2);
  if (number.length === 8) {
    variations.push(`55${ddd}9${number}`);
    variations.push(`${ddd}9${number}`);
  }
  if (number.length === 9 && number.startsWith('9')) {
    variations.push(`55${ddd}${number.slice(1)}`);
    variations.push(`${ddd}${number.slice(1)}`);
  }
  variations.push(withoutDDI);
  return [...new Set(variations)];
}

/**
 * Busca lead pelo telefone
 */
export async function findLeadByPhone(
  supabase: SupabaseClient,
  phoneNormalized: string,
  e164: string,
  empresa: EmpresaTipo
): Promise<LeadContact | null> {
  log.info('Buscando lead por telefone', { phone: phoneNormalized, empresa });

  // 1. Busca por telefone_e164 na empresa específica primeiro
  const { data: e164Match } = await supabase
    .from('lead_contacts')
    .select('*')
    .eq('telefone_e164', e164)
    .eq('empresa', empresa)
    .eq('opt_out', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e164Match) {
    log.info('Match por telefone_e164', { leadId: (e164Match as LeadContact).lead_id });
    return e164Match as LeadContact;
  }

  // 2. Busca em todas as empresas se não encontrar na específica
  const { data: anyMatch } = await supabase
    .from('lead_contacts')
    .select('*')
    .eq('telefone_e164', e164)
    .eq('opt_out', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anyMatch) {
    log.info('Match em outra empresa', { leadId: (anyMatch as LeadContact).lead_id, empresa: (anyMatch as LeadContact).empresa });
    return anyMatch as LeadContact;
  }

  // 3. Tenta variações do telefone
  const variations = generatePhoneVariations(phoneNormalized);
  for (const variant of variations) {
    const { data: match } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('telefone', variant)
      .eq('opt_out', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (match) {
      log.info('Match por variação', { leadId: (match as LeadContact).lead_id });
      return match as LeadContact;
    }
  }

  log.info('Nenhum lead encontrado');
  return null;
}

/**
 * Cria um novo lead automaticamente
 */
export async function createLead(
  supabase: SupabaseClient,
  payload: BlueChatPayload,
  phoneInfo: { normalized: string; e164: string },
  empresa: EmpresaTipo
): Promise<LeadContact | null> {
  const leadId = crypto.randomUUID();

  log.info('Criando novo lead', { leadId, empresa, phone: phoneInfo.e164, name: payload.contact.name });

  const withoutDDI = phoneInfo.normalized.startsWith('55')
    ? phoneInfo.normalized.slice(2)
    : phoneInfo.normalized;
  const numeroNacional = withoutDDI;

  const leadContact = {
    id: crypto.randomUUID(),
    lead_id: leadId,
    empresa,
    nome: payload.contact.name || null,
    primeiro_nome: extractFirstName(payload.contact.name),
    email: payload.contact.email || null,
    telefone: phoneInfo.normalized,
    telefone_e164: phoneInfo.e164,
    telefone_valido: true,
    ddi: '55',
    numero_nacional: numeroNacional,
    origem_telefone: 'BLUECHAT',
    opt_out: false,
  };

  const { data, error } = await supabase
    .from('lead_contacts')
    .insert(leadContact)
    .select()
    .single();

  if (error) {
    log.error('Erro ao criar lead', { error: error.message });
    return null;
  }

  log.info('Lead criado', { leadId: (data as LeadContact).lead_id });

  // Criar classificação inicial
  await supabase.from('lead_classifications').insert({
    lead_id: leadId,
    empresa,
    icp: empresa === 'BLUE' ? 'BLUE_NAO_CLASSIFICADO' : 'TOKENIZA_NAO_CLASSIFICADO',
    temperatura: 'MORNO',
    prioridade: 2,
    origem: 'AUTOMATICA',
  });

  return data as LeadContact;
}

/**
 * Busca run ativa do lead
 */
export async function findActiveRun(
  supabase: SupabaseClient,
  leadId: string,
  empresa: EmpresaTipo
): Promise<LeadCadenceRun | null> {
  const { data } = await supabase
    .from('lead_cadence_runs')
    .select('*')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .eq('status', 'ATIVA')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as LeadCadenceRun | null;
}

/**
 * Verifica se mensagem já foi processada
 */
export async function isDuplicate(
  supabase: SupabaseClient,
  messageId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('lead_messages')
    .select('id')
    .eq('whatsapp_message_id', messageId)
    .limit(1)
    .maybeSingle();

  return !!data;
}
