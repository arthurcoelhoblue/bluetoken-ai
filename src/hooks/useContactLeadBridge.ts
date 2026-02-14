import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeadClassification, ICP, Temperatura, Prioridade, ClassificacaoOrigem } from '@/types/classification';
import type { EmpresaTipo } from '@/types/sgt';

/**
 * Bridge hook: given a contactId, resolves legacy_lead_id and fetches lead_* data
 */
export function useContactLeadBridge(contactId: string | null) {
  // 1. Resolve legacy_lead_id from contacts
  const contactQuery = useQuery({
    queryKey: ['contact-bridge', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('legacy_lead_id, empresa, telefone')
        .eq('id', contactId!)
        .maybeSingle();
      if (error) throw error;
      return data as { legacy_lead_id: string | null; empresa: string; telefone: string | null } | null;
    },
  });

  const legacyLeadId = contactQuery.data?.legacy_lead_id ?? null;
  const empresa = contactQuery.data?.empresa as EmpresaTipo | undefined;
  const telefone = contactQuery.data?.telefone ?? null;

  // 2. Classification
  const classificationQuery = useQuery({
    queryKey: ['contact-bridge-classification', legacyLeadId, empresa],
    enabled: !!legacyLeadId,
    queryFn: async (): Promise<LeadClassification | null> => {
      let query = supabase
        .from('lead_classifications')
        .select('*')
        .eq('lead_id', legacyLeadId!);
      if (empresa) query = query.eq('empresa', empresa);
      query = query.order('classificado_em', { ascending: false }).limit(1);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        lead_id: data.lead_id,
        empresa: data.empresa as 'TOKENIZA' | 'BLUE',
        icp: data.icp as ICP,
        persona: data.persona as LeadClassification['persona'],
        temperatura: data.temperatura as Temperatura,
        prioridade: data.prioridade as Prioridade,
        score_interno: data.score_interno,
        fonte_evento_id: data.fonte_evento_id,
        fonte_evento_tipo: data.fonte_evento_tipo,
        origem: (data.origem || 'AUTOMATICA') as ClassificacaoOrigem,
        override_por_user_id: data.override_por_user_id,
        override_motivo: data.override_motivo,
        classificado_em: data.classificado_em,
        updated_at: data.updated_at,
        justificativa: (data.justificativa as unknown) as LeadClassification['justificativa'],
      };
    },
  });

  // 3. Active cadence run
  const cadenceQuery = useQuery({
    queryKey: ['contact-bridge-cadence', legacyLeadId, empresa],
    enabled: !!legacyLeadId,
    queryFn: async () => {
      let query = supabase
        .from('lead_cadence_runs')
        .select('*')
        .eq('lead_id', legacyLeadId!)
        .eq('status', 'ATIVA');
      if (empresa) query = query.eq('empresa', empresa);
      query = query.order('started_at', { ascending: false }).limit(1);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 4. Conversation state
  const conversationStateQuery = useQuery({
    queryKey: ['contact-bridge-conv-state', legacyLeadId, empresa],
    enabled: !!legacyLeadId && !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_conversation_state')
        .select('*')
        .eq('lead_id', legacyLeadId!)
        .eq('empresa', empresa!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    legacyLeadId,
    empresa,
    telefone,
    classification: classificationQuery.data ?? null,
    cadenceRun: cadenceQuery.data ?? null,
    conversationState: conversationStateQuery.data ?? null,
    isLoading: contactQuery.isLoading || classificationQuery.isLoading,
    isResolved: contactQuery.isSuccess,
  };
}
