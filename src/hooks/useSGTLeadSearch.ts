import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SGTLeadSearchParams {
  email?: string;
  telefone?: string;
}

export function useSGTLeadSearch() {
  return useMutation({
    mutationFn: async (params: SGTLeadSearchParams) => {
      if (!params.email && !params.telefone) {
        throw new Error('Informe email ou telefone');
      }

      const { data, error } = await supabase.functions.invoke('sgt-buscar-lead', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
  });
}
