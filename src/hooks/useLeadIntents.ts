// ========================================
// PATCH 5G-B - Hook para Interpretações de IA
// ========================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeadMessageIntent, LeadIntentTipo, SdrAcaoTipo } from '@/types/intent';
import type { EmpresaTipo } from '@/types/sgt';

interface UseLeadIntentsOptions {
  leadId: string;
  empresa?: EmpresaTipo;
  limit?: number;
  enabled?: boolean;
}

interface UseRunIntentsOptions {
  runId: string;
  limit?: number;
  enabled?: boolean;
}

interface UseMessageIntentOptions {
  messageId: string;
  enabled?: boolean;
}

function mapRowToIntent(row: Record<string, unknown>): LeadMessageIntent {
  return {
    id: row.id as string,
    message_id: row.message_id as string,
    lead_id: row.lead_id as string,
    run_id: row.run_id as string,
    empresa: row.empresa as EmpresaTipo,
    intent: row.intent as LeadIntentTipo,
    intent_confidence: Number(row.intent_confidence),
    intent_summary: row.intent_summary as string,
    acao_recomendada: row.acao_recomendada as SdrAcaoTipo,
    acao_aplicada: row.acao_aplicada as boolean,
    acao_detalhes: row.acao_detalhes as Record<string, unknown> | null,
    modelo_ia: row.modelo_ia as string,
    tokens_usados: row.tokens_usados as number,
    tempo_processamento_ms: row.tempo_processamento_ms as number,
    created_at: row.created_at as string,
    resposta_automatica_texto: (row.resposta_automatica_texto as string) ?? null,
    resposta_enviada_em: (row.resposta_enviada_em as string) ?? null,
  };
}

export function useLeadIntents({ leadId, empresa, limit = 10, enabled = true }: UseLeadIntentsOptions) {
  return useQuery({
    queryKey: ['lead-intents', leadId, empresa, limit],
    queryFn: async () => {
      let query = supabase
        .from('lead_message_intents')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapRowToIntent);
    },
    enabled: enabled && !!leadId,
  });
}

export function useRunIntents({ runId, limit = 20, enabled = true }: UseRunIntentsOptions) {
  return useQuery({
    queryKey: ['run-intents', runId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_message_intents')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapRowToIntent);
    },
    enabled: enabled && !!runId,
  });
}

export function useMessageIntent({ messageId, enabled = true }: UseMessageIntentOptions) {
  return useQuery({
    queryKey: ['message-intent', messageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_message_intents')
        .select('*')
        .eq('message_id', messageId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapRowToIntent(data);
    },
    enabled: enabled && !!messageId,
  });
}
