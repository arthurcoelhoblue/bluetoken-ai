import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EmbeddingStats {
  total: number;
  byType: Record<string, number>;
  byEmpresa: Record<string, number>;
}

export function useKnowledgeEmbeddingStats() {
  return useQuery({
    queryKey: ['knowledge-embedding-stats'],
    queryFn: async (): Promise<EmbeddingStats> => {
      // Count total embeddings
      const { count: total } = await supabase
        .from('knowledge_embeddings' as any)
        .select('*', { count: 'exact', head: true });

      // Count by source_type
      const { data: byTypeData } = await supabase
        .from('knowledge_embeddings' as any)
        .select('source_type');

      const byType: Record<string, number> = {};
      (byTypeData || []).forEach((row: any) => {
        byType[row.source_type] = (byType[row.source_type] || 0) + 1;
      });

      // Count by empresa
      const { data: byEmpresaData } = await supabase
        .from('knowledge_embeddings' as any)
        .select('empresa');

      const byEmpresa: Record<string, number> = {};
      (byEmpresaData || []).forEach((row: any) => {
        byEmpresa[row.empresa] = (byEmpresa[row.empresa] || 0) + 1;
      });

      return { total: total || 0, byType, byEmpresa };
    },
    refetchInterval: 10000, // Poll every 10s during reindexing
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
