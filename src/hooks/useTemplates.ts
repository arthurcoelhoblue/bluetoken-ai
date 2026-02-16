import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from '@/hooks/use-toast';

export interface MessageTemplate {
  id: string;
  empresa: 'BLUE' | 'TOKENIZA';
  canal: 'WHATSAPP' | 'EMAIL';
  codigo: string;
  nome: string;
  descricao: string | null;
  conteudo: string;
  ativo: boolean;
  assunto_template: string | null;
  created_at: string;
  updated_at: string;
}

export type TemplateInsert = Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'>;
export type TemplateUpdate = Partial<TemplateInsert> & { id: string };

const TEMPLATE_PAGE_SIZE = 25;

export function useTemplates(canal?: 'WHATSAPP' | 'EMAIL' | null, page: number = 0) {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['message_templates', activeCompany, canal, page],
    queryFn: async () => {
      let q = supabase.from('message_templates' as any).select('*', { count: 'exact' });

      q = q.eq('empresa', activeCompany);
      if (canal) {
        q = q.eq('canal', canal);
      }
      q = q.order('nome', { ascending: true })
        .range(page * TEMPLATE_PAGE_SIZE, (page + 1) * TEMPLATE_PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      const totalCount = count ?? 0;
      return {
        data: (data ?? []) as unknown as MessageTemplate[],
        totalCount,
        totalPages: Math.ceil(totalCount / TEMPLATE_PAGE_SIZE),
      };
    },
  });
}

export { TEMPLATE_PAGE_SIZE };

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: TemplateInsert) => {
      const { data, error } = await supabase
        .from('message_templates' as any)
        .insert(template as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Template criado com sucesso' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro ao criar template', description: e.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TemplateUpdate) => {
      const { data, error } = await supabase
        .from('message_templates' as any)
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Template atualizado' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro ao atualizar template', description: e.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Template removido' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' });
    },
  });
}
