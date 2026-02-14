import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KnowledgeFaq, FaqStatus } from '@/types/knowledge';

interface FaqFilters {
  status?: FaqStatus | 'all';
  categoria?: string;
  search?: string;
}

export function useKnowledgeFaqList(filters?: FaqFilters) {
  return useQuery({
    queryKey: ['knowledge-faq', filters],
    queryFn: async () => {
      let query = supabase
        .from('knowledge_faq')
        .select('*, autor:criado_por(id, nome)')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.categoria) {
        query = query.eq('categoria', filters.categoria);
      }
      if (filters?.search) {
        query = query.or(`pergunta.ilike.%${filters.search}%,resposta.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as KnowledgeFaq[];
    },
  });
}

export function useCreateFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (faq: {
      pergunta: string;
      resposta: string;
      categoria?: string;
      tags?: string[];
      fonte?: string;
      status: 'RASCUNHO' | 'PENDENTE';
      produto_id?: string | null;
      empresa: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('knowledge_faq')
        .insert({
          ...faq,
          criado_por: user.id,
          tags: faq.tags ?? [],
          fonte: faq.fonte ?? 'MANUAL',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-faq'] });
    },
  });
}

export function useUpdateFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KnowledgeFaq> & { id: string }) => {
      const { error } = await supabase
        .from('knowledge_faq')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-faq'] });
    },
  });
}

export function useResolveFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, motivo_rejeicao, resposta_editada }: {
      id: string;
      action: 'APROVADO' | 'REJEITADO';
      motivo_rejeicao?: string;
      resposta_editada?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const updates: Record<string, unknown> = {
        status: action,
        visivel_amelia: action === 'APROVADO',
        aprovado_por: user.id,
        aprovado_em: new Date().toISOString(),
      };

      if (action === 'REJEITADO' && motivo_rejeicao) {
        updates.motivo_rejeicao = motivo_rejeicao;
      }
      if (resposta_editada) {
        updates.resposta = resposta_editada;
      }

      const { error } = await supabase
        .from('knowledge_faq')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-faq'] });
      qc.invalidateQueries({ queryKey: ['faq-pendencies'] });
      qc.invalidateQueries({ queryKey: ['loss-pendencies'] });
    },
  });
}

export function useDeleteFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_faq')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-faq'] });
    },
  });
}

// Fetch pending FAQs for the manager pendencies page
export function useFaqPendencies() {
  return useQuery({
    queryKey: ['faq-pendencies'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get all pending FAQs
      const { data: faqs, error } = await supabase
        .from('knowledge_faq')
        .select('*, autor:criado_por(id, nome, gestor_id)')
        .eq('status', 'PENDENTE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!faqs || faqs.length === 0) return [];

      // Get current user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some(r => r.role === 'ADMIN') ?? false;

      // Filter: show to gestor of author, or to ADMINs if author has no gestor
      return (faqs as unknown as (KnowledgeFaq & { autor: { id: string; nome: string; gestor_id: string | null } | null })[]).filter(faq => {
        if (!faq.autor) return isAdmin;
        if (faq.autor.gestor_id === user.id) return true;
        if (!faq.autor.gestor_id && isAdmin) return true;
        return false;
      }) as unknown as KnowledgeFaq[];
    },
  });
}

export function useFaqPendencyCount() {
  const { data } = useFaqPendencies();
  return data?.length ?? 0;
}
