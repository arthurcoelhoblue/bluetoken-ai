import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EmpresaTipo, SGTEventoTipo } from '@/types/sgt';
import type {
  LeadClassification,
  ICP,
  Temperatura,
  Prioridade,
  ClassificacaoOrigem,
} from '@/types/classification';

// ========================================
// Types
// ========================================

export interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  primeiro_nome: string | null;
  email: string | null;
  telefone: string | null;
  pipedrive_person_id: string | null;
  pipedrive_deal_id: string | null;
  tokeniza_investor_id: string | null;
  blue_client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SgtEvent {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  evento: SGTEventoTipo;
  payload: Record<string, unknown>;
  recebido_em: string;
  processado_em: string | null;
}

export interface CadenceRun {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  cadence_id: string;
  status: string;
  last_step_ordem: number;
  next_step_ordem: number | null;
  next_run_at: string | null;
  started_at: string;
  updated_at: string;
}

// ========================================
// Hook: useLeadDetail
// ========================================

export function useLeadDetail(leadId: string, empresa?: EmpresaTipo) {
  const contactQuery = useQuery({
    queryKey: ['lead-contact', leadId, empresa],
    queryFn: async (): Promise<LeadContact | null> => {
      if (!leadId) return null;

      let query = supabase
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', leadId);

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error fetching lead contact:', error);
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        lead_id: data.lead_id,
        empresa: data.empresa as EmpresaTipo,
        nome: data.nome,
        primeiro_nome: data.primeiro_nome,
        email: data.email,
        telefone: data.telefone,
        pipedrive_person_id: data.pipedrive_person_id,
        pipedrive_deal_id: data.pipedrive_deal_id,
        tokeniza_investor_id: data.tokeniza_investor_id,
        blue_client_id: data.blue_client_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    },
    enabled: !!leadId,
  });

  const classificationQuery = useQuery({
    queryKey: ['lead-classification-detail', leadId, empresa],
    queryFn: async (): Promise<LeadClassification | null> => {
      if (!leadId) return null;

      let query = supabase
        .from('lead_classifications')
        .select('*')
        .eq('lead_id', leadId);

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      query = query.order('classificado_em', { ascending: false }).limit(1);

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error fetching classification:', error);
        throw error;
      }

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
      };
    },
    enabled: !!leadId,
  });

  const sgtEventsQuery = useQuery({
    queryKey: ['lead-sgt-events', leadId, empresa],
    queryFn: async (): Promise<SgtEvent[]> => {
      if (!leadId) return [];

      let query = supabase
        .from('sgt_events')
        .select('*')
        .eq('lead_id', leadId);

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      query = query.order('recebido_em', { ascending: false }).limit(50);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching SGT events:', error);
        throw error;
      }

      return (data || []).map((event) => ({
        id: event.id,
        lead_id: event.lead_id,
        empresa: event.empresa as EmpresaTipo,
        evento: event.evento as SGTEventoTipo,
        payload: event.payload as Record<string, unknown>,
        recebido_em: event.recebido_em,
        processado_em: event.processado_em,
      }));
    },
    enabled: !!leadId,
  });

  const cadenceRunQuery = useQuery({
    queryKey: ['lead-cadence-run', leadId, empresa],
    queryFn: async (): Promise<CadenceRun | null> => {
      if (!leadId) return null;

      let query = supabase
        .from('lead_cadence_runs')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'ATIVA');

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      query = query.order('started_at', { ascending: false }).limit(1);

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error fetching cadence run:', error);
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        lead_id: data.lead_id,
        empresa: data.empresa as EmpresaTipo,
        cadence_id: data.cadence_id,
        status: data.status,
        last_step_ordem: data.last_step_ordem,
        next_step_ordem: data.next_step_ordem,
        next_run_at: data.next_run_at,
        started_at: data.started_at,
        updated_at: data.updated_at,
      };
    },
    enabled: !!leadId,
  });

  const refetch = () => {
    contactQuery.refetch();
    classificationQuery.refetch();
    sgtEventsQuery.refetch();
    cadenceRunQuery.refetch();
  };

  return {
    contact: contactQuery.data,
    classification: classificationQuery.data,
    sgtEvents: sgtEventsQuery.data,
    cadenceRun: cadenceRunQuery.data,
    isLoading:
      contactQuery.isLoading ||
      classificationQuery.isLoading ||
      sgtEventsQuery.isLoading ||
      cadenceRunQuery.isLoading,
    error: contactQuery.error || classificationQuery.error,
    refetch,
  };
}
