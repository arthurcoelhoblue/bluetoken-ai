// ========================================
// bluechat-inbound/triage.ts — Parser de resumo de triagem
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import type { TriageSummary, LeadContact } from "./types.ts";
import { extractFirstName } from "./contact-resolver.ts";

const log = createLogger('bluechat-inbound');

/**
 * Detecta e parseia o formato [NOVO ATENDIMENTO] enviado pela triagem (MarIA)
 * Retorna null se a mensagem não é um resumo de triagem
 */
export function parseTriageSummary(text: string): TriageSummary | null {
  if (!text.includes('[NOVO ATENDIMENTO]')) return null;

  log.info('Resumo de triagem detectado');

  let clienteNome: string | null = null;
  let telefone: string | null = null;
  let email: string | null = null;
  let resumoTriagem: string | null = null;
  let historico: string | null = null;

  const nomeMatch = text.match(/Cliente:\s*(.+)/i);
  if (nomeMatch) clienteNome = nomeMatch[1].trim();

  const telMatch = text.match(/Telefone:\s*(\+?\d[\d\s\-]+)/i);
  if (telMatch) telefone = telMatch[1].replace(/[\s\-]/g, '').trim();

  const emailMatch = text.match(/Email:\s*(\S+@\S+)/i);
  if (emailMatch) email = emailMatch[1].trim();

  const resumoMatch = text.match(/Resumo da conversa anterior[^:]*:\s*([\s\S]*?)(?=Historico:|Histórico:|$)/i);
  if (resumoMatch) resumoTriagem = resumoMatch[1].trim();

  const histMatch = text.match(/Histori[cç]o:\s*([\s\S]*?)(?=Inicie o atendimento|$)/i);
  if (histMatch) historico = histMatch[1].trim();

  log.info('Dados de triagem extraídos', {
    clienteNome,
    telefone,
    email: email ? '***' : null,
    temResumo: !!resumoTriagem,
    temHistorico: !!historico,
  });

  return { clienteNome, telefone, email, resumoTriagem, historico, rawSummary: text };
}

/**
 * Atualiza dados do lead_contacts com informações extraídas da triagem
 */
export async function enrichLeadFromTriage(
  supabase: SupabaseClient,
  leadContact: LeadContact,
  triage: TriageSummary
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (triage.clienteNome && !leadContact.nome) {
    updates.nome = triage.clienteNome;
    updates.primeiro_nome = extractFirstName(triage.clienteNome);
  }

  if (triage.email && !leadContact.email) {
    updates.email = triage.email;
  }

  if (Object.keys(updates).length > 0) {
    log.info('Enriquecendo lead com dados da triagem', updates);
    await supabase
      .from('lead_contacts')
      .update(updates)
      .eq('id', leadContact.id);
  }
}
