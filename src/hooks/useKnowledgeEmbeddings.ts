import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EmbeddingStats {
  total: number;
  byType: Record<string, number>;
  byEmpresa: Record<string, number>;
}

interface FeedbackStats {
  total: number;
  util: number;
  naoUtil: number;
  pendente: number;
  efficacyRate: number;
}

export function useKnowledgeEmbeddingStats() {
  return useQuery({
    queryKey: ['knowledge-embedding-stats'],
    queryFn: async (): Promise<EmbeddingStats> => {
      const { count: total } = await supabase
        .from('knowledge_embeddings' as any)
        .select('*', { count: 'exact', head: true });

      const { data: byTypeData } = await supabase
        .from('knowledge_embeddings' as any)
        .select('source_type');

      const byType: Record<string, number> = {};
      (byTypeData || []).forEach((row: any) => {
        byType[row.source_type] = (byType[row.source_type] || 0) + 1;
      });

      const { data: byEmpresaData } = await supabase
        .from('knowledge_embeddings' as any)
        .select('empresa');

      const byEmpresa: Record<string, number> = {};
      (byEmpresaData || []).forEach((row: any) => {
        byEmpresa[row.empresa] = (byEmpresa[row.empresa] || 0) + 1;
      });

      return { total: total || 0, byType, byEmpresa };
    },
    refetchInterval: 10000,
  });
}

export function useKnowledgeSectionCount() {
  return useQuery({
    queryKey: ['knowledge-section-count'],
    queryFn: async () => {
      const { count: sections } = await supabase
        .from('knowledge_sections')
        .select('*', { count: 'exact', head: true });

      const { count: faqs } = await supabase
        .from('knowledge_faq')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'APROVADO')
        .eq('visivel_amelia', true);

      return { sections: sections || 0, faqs: faqs || 0 };
    },
  });
}

export function useKnowledgeFeedbackStats() {
  return useQuery({
    queryKey: ['knowledge-feedback-stats'],
    queryFn: async (): Promise<FeedbackStats> => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('knowledge_search_feedback' as any)
        .select('outcome')
        .gte('created_at', sevenDaysAgo);

      const rows = data || [];
      const total = rows.length;
      const util = rows.filter((r: any) => r.outcome === 'UTIL').length;
      const naoUtil = rows.filter((r: any) => r.outcome === 'NAO_UTIL').length;
      const pendente = total - util - naoUtil;
      const efficacyRate = total > 0 ? Math.round((util / total) * 100) : 0;

      return { total, util, naoUtil, pendente, efficacyRate };
    },
    refetchInterval: 30000,
  });
}

export function useReindexKnowledge() {
  return useMutation({
    mutationFn: async (empresa?: string) => {
      const { data, error } = await supabase.functions.invoke('knowledge-embed', {
        body: { action: 'reindex', empresa },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useEmbedSection() {
  return useMutation({
    mutationFn: async (sectionId: string) => {
      const { data, error } = await supabase.functions.invoke('knowledge-embed', {
        body: { action: 'embed_section', source_id: sectionId },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useEmbedFaq() {
  return useMutation({
    mutationFn: async (faqId: string) => {
      const { data, error } = await supabase.functions.invoke('knowledge-embed', {
        body: { action: 'embed_faq', source_id: faqId },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useRunFeedbackLearner() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('knowledge-feedback-learner', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
  });
}
