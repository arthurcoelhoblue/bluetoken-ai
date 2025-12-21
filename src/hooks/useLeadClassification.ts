// ========================================
// PATCH 3.0 - Hooks de Classificação de Leads
// ========================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EmpresaTipo } from '@/types/sgt';
import type {
  LeadClassification,
  LeadWithClassification,
  ICP,
  Temperatura,
  Prioridade,
  ClassificacaoOrigem,
} from '@/types/classification';

// ========================================
// Tipos de filtros para listagem
// ========================================

export interface LeadsClassificationFilters {
  empresa?: EmpresaTipo;
  icp?: ICP;
  temperatura?: Temperatura;
  prioridade?: Prioridade;
  origem?: ClassificacaoOrigem;
  searchTerm?: string; // busca por nome, email ou lead_id
}

export interface UseLeadsWithClassificationOptions {
  filters: LeadsClassificationFilters;
  page?: number;
  pageSize?: number;
}

// ========================================
// Hook: useLeadClassification
// Busca a classificação de um lead específico
// ========================================

export function useLeadClassification(
  leadId: string | null,
  empresa?: EmpresaTipo
) {
  return useQuery({
    queryKey: ['lead-classification', leadId, empresa],
    queryFn: async (): Promise<LeadClassification | null> => {
      if (!leadId) return null;

      let query = supabase
        .from('lead_classifications')
        .select('*')
        .eq('lead_id', leadId);

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      // Pegar a classificação mais recente
      query = query.order('classificado_em', { ascending: false }).limit(1);

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Erro ao buscar classificação:', error);
        throw error;
      }

      if (!data) return null;

      // Mapear para o tipo correto
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
    enabled: !!leadId,
  });
}

// ========================================
// Hook: useLeadsWithClassification
// Lista leads com suas classificações (para listagem)
// ========================================

export function useLeadsWithClassification(
  options: UseLeadsWithClassificationOptions
) {
  const { filters, page = 1, pageSize = 20 } = options;

  return useQuery({
    queryKey: ['leads-with-classification', filters, page, pageSize],
    queryFn: async (): Promise<{
      data: LeadWithClassification[];
      totalCount: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }> => {
      // Primeiro, buscar lead_contacts com filtro de empresa
      let contactsQuery = supabase
        .from('lead_contacts')
        .select('*', { count: 'exact' });

      if (filters.empresa) {
        contactsQuery = contactsQuery.eq('empresa', filters.empresa);
      }

      if (filters.searchTerm) {
        contactsQuery = contactsQuery.or(
          `nome.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%,lead_id.ilike.%${filters.searchTerm}%`
        );
      }

      // Paginação
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      contactsQuery = contactsQuery
        .order('updated_at', { ascending: false })
        .range(from, to);

      const { data: contacts, error: contactsError, count } = await contactsQuery;

      if (contactsError) {
        console.error('Erro ao buscar contatos:', contactsError);
        throw contactsError;
      }

      if (!contacts || contacts.length === 0) {
        return {
          data: [],
          totalCount: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }

      // Buscar classificações para esses leads
      const leadIds = contacts.map((c) => c.lead_id);
      let classificationsQuery = supabase
        .from('lead_classifications')
        .select('*')
        .in('lead_id', leadIds);

      // Aplicar filtros de classificação
      if (filters.icp) {
        classificationsQuery = classificationsQuery.eq('icp', filters.icp);
      }
      if (filters.temperatura) {
        classificationsQuery = classificationsQuery.eq('temperatura', filters.temperatura);
      }
      if (filters.prioridade) {
        classificationsQuery = classificationsQuery.eq('prioridade', filters.prioridade);
      }
      if (filters.origem) {
        classificationsQuery = classificationsQuery.eq('origem', filters.origem);
      }

      const { data: classifications, error: classificationsError } =
        await classificationsQuery;

      if (classificationsError) {
        console.error('Erro ao buscar classificações:', classificationsError);
        throw classificationsError;
      }

      // Criar mapa de classificações por lead_id + empresa
      const classificationMap = new Map<string, LeadClassification>();
      classifications?.forEach((c) => {
        const key = `${c.lead_id}:${c.empresa}`;
        const existing = classificationMap.get(key);
        // Manter a mais recente
        if (!existing || new Date(c.classificado_em) > new Date(existing.classificado_em)) {
          classificationMap.set(key, {
            id: c.id,
            lead_id: c.lead_id,
            empresa: c.empresa as 'TOKENIZA' | 'BLUE',
            icp: c.icp as ICP,
            persona: c.persona as LeadClassification['persona'],
            temperatura: c.temperatura as Temperatura,
            prioridade: c.prioridade as Prioridade,
            score_interno: c.score_interno,
            fonte_evento_id: c.fonte_evento_id,
            fonte_evento_tipo: c.fonte_evento_tipo,
            origem: (c.origem || 'AUTOMATICA') as ClassificacaoOrigem,
            override_por_user_id: c.override_por_user_id,
            override_motivo: c.override_motivo,
            classificado_em: c.classificado_em,
            updated_at: c.updated_at,
            justificativa: (c.justificativa as unknown) as LeadClassification['justificativa'],
          });
        }
      });

      // Combinar contatos com classificações
      const leadsWithClassification: LeadWithClassification[] = contacts
        .map((contact) => {
          const key = `${contact.lead_id}:${contact.empresa}`;
          const classification = classificationMap.get(key) || null;

          // Se há filtros de classificação e o lead não tem classificação correspondente, excluir
          if (
            (filters.icp || filters.temperatura || filters.prioridade || filters.origem) &&
            !classification
          ) {
            return null;
          }

          return {
            lead_id: contact.lead_id,
            empresa: contact.empresa as 'TOKENIZA' | 'BLUE',
            nome: contact.nome,
            primeiro_nome: contact.primeiro_nome,
            email: contact.email,
            telefone: contact.telefone,
            contact_updated_at: contact.updated_at,
            classification,
          };
        })
        .filter((l): l is LeadWithClassification => l !== null);

      const totalCount = count || 0;

      return {
        data: leadsWithClassification,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
  });
}

// ========================================
// Função auxiliar: getLeadClassification
// Para uso fora de componentes React
// ========================================

export async function getLeadClassification(
  leadId: string,
  empresa?: EmpresaTipo
): Promise<LeadClassification | null> {
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
    console.error('Erro ao buscar classificação:', error);
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
    justificativa: (data.justificativa as unknown) as LeadClassification['justificativa'],
  };
}
