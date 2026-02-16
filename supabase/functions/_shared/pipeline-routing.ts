// ========================================
// _shared/pipeline-routing.ts — Roteamento de pipelines e dedup de deals
// ========================================

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { EmpresaTipo, Temperatura, TipoLead } from "./types.ts";
import { isPlaceholderEmailForDedup, generatePhoneVariationsForSearch } from "./phone-utils.ts";
import { createLogger } from "./logger.ts";

const log = createLogger('pipeline-routing');

// Blue
const PIPELINE_BLUE = '21e577cc-32eb-4f1c-895e-b11bfc056e99';
const STAGE_BLUE: Record<Temperatura, string> = {
  'FRIO': '7e6ee75a-8efd-4cc4-8264-534bf77993c7',
  'MORNO': 'bb39da09-d2cb-4111-a662-85c69e057077',
  'QUENTE': 'e7cca7b0-941a-4522-9543-fc0d975b9dac',
};

// Tokeniza Captador
const PIPELINE_TOKENIZA_CAPTADOR = 'a74d511a-f8b4-4d14-9f5c-0c13da61cb15';
const STAGE_TOKENIZA_CAPTADOR: Record<Temperatura, string> = {
  'FRIO': 'f45b020e-1247-42a1-89e7-bd0caf614a7e',
  'MORNO': 'ece6bc09-c924-4b30-b064-e792f8e44c72',
  'QUENTE': '34aa1201-d14d-46d9-8ce6-108ac811e79f',
};

// Tokeniza Investidor (default)
const PIPELINE_TOKENIZA_INVESTIDOR = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c';
const STAGE_TOKENIZA_INVESTIDOR: Record<Temperatura, string> = {
  'FRIO': 'da80e912-b462-401d-b367-1b6a9b2ec4da',
  'MORNO': '90b33102-0472-459e-8eef-a455b0d37acf',
  'QUENTE': 'c48dc6c2-c5dc-47c1-9f27-c058b01898c3',
};

/**
 * Resolve o pipeline e stage alvo baseado na empresa, tipo de lead, temperatura e prioridade
 */
export function resolveTargetPipeline(
  empresa: EmpresaTipo,
  tipoLead: TipoLead,
  temperatura: Temperatura,
  isPriority: boolean
): { pipelineId: string; stageId: string } {
  if (empresa === 'BLUE') {
    return {
      pipelineId: PIPELINE_BLUE,
      stageId: isPriority ? STAGE_BLUE['QUENTE'] : (STAGE_BLUE[temperatura] || STAGE_BLUE['FRIO']),
    };
  }

  if (tipoLead === 'CAPTADOR') {
    return {
      pipelineId: PIPELINE_TOKENIZA_CAPTADOR,
      stageId: STAGE_TOKENIZA_CAPTADOR[temperatura] || STAGE_TOKENIZA_CAPTADOR['FRIO'],
    };
  }

  // Default: Tokeniza Investidor
  return {
    pipelineId: PIPELINE_TOKENIZA_INVESTIDOR,
    stageId: isPriority
      ? STAGE_TOKENIZA_INVESTIDOR['QUENTE']
      : (STAGE_TOKENIZA_INVESTIDOR[temperatura] || STAGE_TOKENIZA_INVESTIDOR['FRIO']),
  };
}

/**
 * Busca deal existente para evitar duplicatas.
 * Hierarquia: CPF → telefone_e164 → variações de telefone → email
 */
export async function findExistingDealForPerson(
  supabase: SupabaseClient,
  empresa: EmpresaTipo,
  dados: { telefone_e164?: string | null; telefone?: string | null; email?: string | null; cpf?: string | null }
): Promise<{ contactId: string; dealId: string } | null> {
  const extractDeal = (row: Record<string, unknown>): { contactId: string; dealId: string } | null => {
    const deals = row.deals as unknown;
    const dealId = Array.isArray(deals)
      ? (deals[0] as Record<string, string>)?.id
      : (deals as Record<string, string>)?.id;
    return dealId ? { contactId: row.id as string, dealId } : null;
  };

  // 1. CPF exato
  if (dados.cpf) {
    const cleaned = dados.cpf.replace(/\D/g, '');
    if (cleaned.length >= 11) {
      const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
        .eq('empresa', empresa).eq('cpf', cleaned).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
      if (data) {
        const m = extractDeal(data as Record<string, unknown>);
        if (m) { log.info('Dedup match CPF', m); return m; }
      }
    }
  }

  // 2. telefone_e164 exato
  if (dados.telefone_e164) {
    const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
      .eq('empresa', empresa).eq('telefone_e164', dados.telefone_e164).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
    if (data) {
      const m = extractDeal(data as Record<string, unknown>);
      if (m) { log.info('Dedup match telefone_e164', m); return m; }
    }
  }

  // 3. Variações de telefone
  const phoneVars = generatePhoneVariationsForSearch(dados.telefone || dados.telefone_e164);
  if (phoneVars.length > 0) {
    const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
      .eq('empresa', empresa).in('telefone_e164', phoneVars).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
    if (data) {
      const m = extractDeal(data as Record<string, unknown>);
      if (m) { log.info('Dedup match variação tel', m); return m; }
    }
  }

  // 4. Email exato (excluindo placeholders)
  if (dados.email && !isPlaceholderEmailForDedup(dados.email)) {
    const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
      .eq('empresa', empresa).eq('email', dados.email.trim().toLowerCase()).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
    if (data) {
      const m = extractDeal(data as Record<string, unknown>);
      if (m) { log.info('Dedup match email', m); return m; }
    }
  }

  log.debug('Nenhuma duplicata encontrada');
  return null;
}
