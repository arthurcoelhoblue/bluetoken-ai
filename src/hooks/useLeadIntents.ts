// ========================================
// PATCH 5G - Hook para Interpretações de IA
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

      return (data || []).map((row): LeadMessageIntent => ({
        id: row.id,
        message_id: row.message_id,
        lead_id: row.lead_id,
        run_id: row.run_id,
        empresa: row.empresa as EmpresaTipo,
        intent: row.intent as LeadIntentTipo,
        intent_confidence: Number(row.intent_confidence),
        intent_summary: row.intent_summary,
        acao_recomendada: row.acao_recomendada as SdrAcaoTipo,
        acao_aplicada: row.acao_aplicada,
        acao_detalhes: row.acao_detalhes as Record<string, unknown> | null,
        modelo_ia: row.modelo_ia,
        tokens_usados: row.tokens_usados,
        tempo_processamento_ms: row.tempo_processamento_ms,
        created_at: row.created_at,
      }));
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

      return (data || []).map((row): LeadMessageIntent => ({
        id: row.id,
        message_id: row.message_id,
        lead_id: row.lead_id,
        run_id: row.run_id,
        empresa: row.empresa as EmpresaTipo,
        intent: row.intent as LeadIntentTipo,
        intent_confidence: Number(row.intent_confidence),
        intent_summary: row.intent_summary,
        acao_recomendada: row.acao_recomendada as SdrAcaoTipo,
        acao_aplicada: row.acao_aplicada,
        acao_detalhes: row.acao_detalhes as Record<string, unknown> | null,
        modelo_ia: row.modelo_ia,
        tokens_usados: row.tokens_usados,
        tempo_processamento_ms: row.tempo_processamento_ms,
        created_at: row.created_at,
      }));
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

      return {
        id: data.id,
        message_id: data.message_id,
        lead_id: data.lead_id,
        run_id: data.run_id,
        empresa: data.empresa as EmpresaTipo,
        intent: data.intent as LeadIntentTipo,
        intent_confidence: Number(data.intent_confidence),
        intent_summary: data.intent_summary,
        acao_recomendada: data.acao_recomendada as SdrAcaoTipo,
        acao_aplicada: data.acao_aplicada,
        acao_detalhes: data.acao_detalhes as Record<string, unknown> | null,
        modelo_ia: data.modelo_ia,
        tokens_usados: data.tokens_usados,
        tempo_processamento_ms: data.tempo_processamento_ms,
        created_at: data.created_at,
      } as LeadMessageIntent;
    },
    enabled: enabled && !!messageId,
  });
}
