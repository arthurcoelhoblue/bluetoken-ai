import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DealAutoFillSuggestion {
  titulo: string | null;
  valor: number | null;
  temperatura: 'FRIO' | 'MORNO' | 'QUENTE' | null;
}

/**
 * Busca os últimos intents de IA para um contato e extrai sugestões
 * de auto-preenchimento para criação de deals.
 */
export function useDealAutoFill(contactId: string | undefined) {
  return useQuery({
    queryKey: ['deal-auto-fill', contactId],
    queryFn: async (): Promise<DealAutoFillSuggestion> => {
      // Buscar o lead_id associado ao contato via legacy_lead_id ou contacts
      const { data: contact } = await supabase
        .from('contacts')
        .select('legacy_lead_id, nome')
        .eq('id', contactId!)
        .maybeSingle();

      if (!contact?.legacy_lead_id) {
        return { titulo: null, valor: null, temperatura: null };
      }

      // Buscar últimos intents desse lead
      const { data: intents } = await supabase
        .from('lead_message_intents')
        .select('intent, intent_summary, acao_detalhes, acao_recomendada')
        .eq('lead_id', contact.legacy_lead_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!intents || intents.length === 0) {
        return { titulo: null, valor: null, temperatura: null };
      }

      let valor: number | null = null;
      let temperatura: 'FRIO' | 'MORNO' | 'QUENTE' | null = null;
      let titulo: string | null = null;

      for (const intent of intents) {
        const detalhes = intent.acao_detalhes as Record<string, unknown> | null;
        
        if (detalhes) {
          if (!valor && typeof detalhes.valor_mencionado === 'number') {
            valor = detalhes.valor_mencionado;
          }
          if (!titulo && typeof detalhes.necessidade_principal === 'string') {
            titulo = `${contact.nome} - ${detalhes.necessidade_principal}`;
          }
          if (!temperatura && typeof detalhes.urgencia === 'string') {
            const urg = detalhes.urgencia as string;
            if (urg === 'ALTA' || urg === 'URGENTE') temperatura = 'QUENTE';
            else if (urg === 'MEDIA') temperatura = 'MORNO';
            else temperatura = 'FRIO';
          }
        }

        // Inferir temperatura pelo tipo de intent
        if (!temperatura) {
          const intentStr = String(intent.intent);
          if (intentStr === 'INTERESSE_COMPRA' || intent.acao_recomendada === 'CRIAR_TAREFA_CLOSER') {
            temperatura = 'QUENTE';
          } else if (intentStr === 'INTERESSE_INFORMACAO' || intentStr === 'DUVIDA_PRODUTO' || intentStr === 'DUVIDA_PRECO') {
            temperatura = 'MORNO';
          }
        }
      }

      return { titulo, valor, temperatura };
    },
    enabled: !!contactId,
    staleTime: 30_000,
  });
}
