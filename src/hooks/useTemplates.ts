import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from '@/hooks/use-toast';

export type MetaStatus = 'LOCAL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';

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
  meta_template_id: string | null;
  meta_status: MetaStatus;
  meta_category: string | null;
  meta_language: string;
  meta_components: unknown | null;
  meta_rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type TemplateInsert = Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'>;
export type TemplateUpdate = Partial<TemplateInsert> & { id: string };

const TEMPLATE_PAGE_SIZE = 25;

export function useTemplates(canal?: 'WHATSAPP' | 'EMAIL' | null, page: number = 0, metaStatus?: MetaStatus | null) {
  const { activeCompanies } = useCompany();

  return useQuery({
    queryKey: ['message_templates', activeCompanies, canal, page, metaStatus],
    queryFn: async () => {
      let q = supabase.from('message_templates' as any).select('*', { count: 'exact' });

      q = q.in('empresa', activeCompanies);
      if (canal) q = q.eq('canal', canal);
      if (metaStatus) q = q.eq('meta_status', metaStatus);
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

// ========================================
// Meta Cloud hooks
// ========================================

export function useSyncMetaTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (empresa: string) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-template-manager', {
        method: 'PATCH',
        body: {},
        headers: {},
      });
      // supabase.functions.invoke doesn't support query params natively,
      // so we use the full URL approach
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/whatsapp-template-manager?empresa=${empresa}`;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Sincronização concluída', description: `${data.synced} templates atualizados` });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro na sincronização', description: e.message, variant: 'destructive' });
    },
  });
}

export function useSubmitTemplateToMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      empresa: string;
      localTemplateId: string;
      name: string;
      category: string;
      language: string;
      components: unknown[];
    }) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/whatsapp-template-manager?empresa=${params.empresa}`;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          name: params.name,
          category: params.category,
          language: params.language,
          components: params.components,
          localTemplateId: params.localTemplateId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }));
        throw new Error(err.error || err.details?.error?.message || `Erro ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message_templates'] });
      toast({ title: 'Template submetido à Meta', description: 'Aguardando aprovação' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro ao submeter à Meta', description: e.message, variant: 'destructive' });
    },
  });
}
