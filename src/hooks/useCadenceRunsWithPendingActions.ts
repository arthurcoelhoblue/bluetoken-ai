// Hook para buscar cadence runs com ações pendentes por tipo
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SdrAcaoTipo } from '@/types/intent';

export interface CadenceRunWithPendingAction {
  run_id: string;
  lead_id: string;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  cadence_nome: string;
  cadence_codigo: string;
  status: string;
  lead_nome: string | null;
  lead_email: string | null;
  acao_recomendada: SdrAcaoTipo;
  intent: string;
  intent_summary: string | null;
  created_at: string;
}

export function useCadenceRunsWithPendingActions(acaoTipo: SdrAcaoTipo | null) {
  return useQuery({
    queryKey: ['cadence-runs-pending-actions', acaoTipo],
    queryFn: async (): Promise<CadenceRunWithPendingAction[]> => {
      if (!acaoTipo) return [];

      // Buscar intents com ação pendente que têm run_id
      const { data: intents, error: intentsError } = await supabase
        .from('lead_message_intents')
        .select('lead_id, empresa, run_id, acao_recomendada, intent, intent_summary, created_at')
        .eq('acao_recomendada', acaoTipo)
        .eq('acao_aplicada', false)
        .not('run_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (intentsError) {
        throw intentsError;
      }

      if (!intents || intents.length === 0) {
        return [];
      }

      // Buscar dados das runs
      const runIds = [...new Set(intents.map(i => i.run_id).filter(Boolean))];
      
      const { data: runs, error: runsError } = await supabase
        .from('lead_cadence_runs')
        .select(`
          id,
          lead_id,
          empresa,
          status,
          cadences (
            nome,
            codigo
          )
        `)
        .in('id', runIds);

      if (runsError) {
        throw runsError;
      }

      // Buscar dados de contato dos leads
      const leadIds = [...new Set(intents.map(i => i.lead_id).filter(Boolean))];
      
      const { data: contacts, error: contactsError } = await supabase
        .from('lead_contacts')
        .select('lead_id, empresa, nome, email')
        .in('lead_id', leadIds);

      if (contactsError) {
        throw contactsError;
      }

      // Criar mapas
      const runMap = new Map<string, typeof runs[0]>();
      runs?.forEach(r => runMap.set(r.id, r));

      const contactMap = new Map<string, typeof contacts[0]>();
      contacts?.forEach(c => contactMap.set(`${c.lead_id}:${c.empresa}`, c));

      // Combinar dados
      return intents
        .filter(intent => intent.run_id && runMap.has(intent.run_id))
        .map(intent => {
          const run = runMap.get(intent.run_id!);
          const contact = contactMap.get(`${intent.lead_id}:${intent.empresa}`);
          const cadence = run?.cadences as { nome: string; codigo: string } | null;

          return {
            run_id: intent.run_id!,
            lead_id: intent.lead_id || '',
            empresa: intent.empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
            cadence_nome: cadence?.nome || 'Cadência desconhecida',
            cadence_codigo: cadence?.codigo || '-',
            status: run?.status || 'ATIVA',
            lead_nome: contact?.nome || null,
            lead_email: contact?.email || null,
            acao_recomendada: intent.acao_recomendada as SdrAcaoTipo,
            intent: intent.intent,
            intent_summary: intent.intent_summary,
            created_at: intent.created_at,
          };
        });
    },
    enabled: !!acaoTipo,
    staleTime: 30 * 1000,
  });
}
