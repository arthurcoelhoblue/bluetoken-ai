// Hook para buscar leads com ações pendentes por tipo
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SdrAcaoTipo } from '@/types/intent';

export interface LeadWithPendingAction {
  lead_id: string;
  empresa: 'TOKENIZA' | 'BLUE';
  nome: string | null;
  primeiro_nome: string | null;
  email: string | null;
  telefone: string | null;
  acao_recomendada: SdrAcaoTipo;
  intent: string;
  intent_summary: string | null;
  created_at: string;
  message_id: string;
}

export function useLeadsWithPendingActions(acaoTipo: SdrAcaoTipo | null) {
  return useQuery({
    queryKey: ['leads-pending-actions', acaoTipo],
    queryFn: async (): Promise<LeadWithPendingAction[]> => {
      if (!acaoTipo) return [];

      // Buscar intents com ação pendente (não aplicada)
      const { data: intents, error: intentsError } = await supabase
        .from('lead_message_intents')
        .select('lead_id, empresa, acao_recomendada, intent, intent_summary, created_at, message_id')
        .eq('acao_recomendada', acaoTipo)
        .eq('acao_aplicada', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (intentsError) {
        throw intentsError;
      }

      if (!intents || intents.length === 0) {
        return [];
      }

      // Buscar dados de contato dos leads
      const leadIds = [...new Set(intents.map(i => i.lead_id).filter(Boolean))];
      
      const { data: contacts, error: contactsError } = await supabase
        .from('lead_contacts')
        .select('lead_id, empresa, nome, primeiro_nome, email, telefone')
        .in('lead_id', leadIds);

      if (contactsError) {
        throw contactsError;
      }

      // Criar mapa de contatos
      const contactMap = new Map<string, typeof contacts[0]>();
      contacts?.forEach(c => {
        contactMap.set(`${c.lead_id}:${c.empresa}`, c);
      });

      // Combinar dados
      return intents.map(intent => {
        const contact = contactMap.get(`${intent.lead_id}:${intent.empresa}`);
        return {
          lead_id: intent.lead_id || '',
          empresa: intent.empresa as 'TOKENIZA' | 'BLUE',
          nome: contact?.nome || null,
          primeiro_nome: contact?.primeiro_nome || null,
          email: contact?.email || null,
          telefone: contact?.telefone || null,
          acao_recomendada: intent.acao_recomendada as SdrAcaoTipo,
          intent: intent.intent,
          intent_summary: intent.intent_summary,
          created_at: intent.created_at,
          message_id: intent.message_id,
        };
      });
    },
    enabled: !!acaoTipo,
    staleTime: 30 * 1000,
  });
}
