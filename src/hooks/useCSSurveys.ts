import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CSSurvey, CSSurveyTipo } from '@/types/customerSuccess';

export function useCSSurveys(customerId?: string) {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['cs-surveys', activeCompany, customerId],
    queryFn: async () => {
      let query = supabase
        .from('cs_surveys')
        .select('*, customer:cs_customers!cs_surveys_customer_id_fkey(id, contact:contacts!cs_customers_contact_id_fkey(nome))')
        .order('enviado_em', { ascending: false })
        .limit(200);

      if (activeCompany && activeCompany !== 'ALL') {
        query = query.eq('empresa', activeCompany as any);
      }
      if (customerId) query = query.eq('customer_id', customerId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CSSurvey[];
    },
  });
}

export function useCreateSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (survey: {
      customer_id: string;
      empresa: string;
      tipo: CSSurveyTipo;
      pergunta?: string;
      nota?: number;
      texto_resposta?: string;
    }) => {
      const { data, error } = await supabase
        .from('cs_surveys')
        .insert(survey as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-surveys'] });
      qc.invalidateQueries({ queryKey: ['cs-metrics'] });
    },
  });
}

export function useRespondSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nota, texto_resposta }: { id: string; nota: number; texto_resposta?: string }) => {
      const { data, error } = await supabase
        .from('cs_surveys')
        .update({ nota, texto_resposta, respondido_em: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-surveys'] });
      qc.invalidateQueries({ queryKey: ['cs-metrics'] });
    },
  });
}
