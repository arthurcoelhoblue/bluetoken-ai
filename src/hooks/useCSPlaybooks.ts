import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CSPlaybook } from '@/types/customerSuccess';
import { useCompany } from '@/contexts/CompanyContext';

export function useCSPlaybooks() {
  const { activeCompany } = useCompany();
  const empresa = activeCompany === 'ALL' ? undefined : activeCompany;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cs-playbooks', empresa],
    queryFn: async () => {
      let q = supabase
        .from('cs_playbooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (empresa) q = q.eq('empresa', empresa);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CSPlaybook[];
    },
  });

  const createPlaybook = useMutation({
    mutationFn: async (playbook: Omit<CSPlaybook, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('cs_playbooks')
        .insert(playbook as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cs-playbooks'] }),
  });

  const updatePlaybook = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CSPlaybook> & { id: string }) => {
      const { error } = await supabase
        .from('cs_playbooks')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cs-playbooks'] }),
  });

  const deletePlaybook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cs_playbooks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cs-playbooks'] }),
  });

  return { ...query, createPlaybook, updatePlaybook, deletePlaybook };
}
