import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

export interface BehavioralKnowledge {
  id: string;
  empresa: string;
  titulo: string;
  autor: string | null;
  descricao: string | null;
  storage_path: string | null;
  nome_arquivo: string;
  ativo: boolean;
  chunks_count: number;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
}

export function useBehavioralKnowledgeList() {
  return useQuery({
    queryKey: ['behavioral-knowledge'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('behavioral_knowledge' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BehavioralKnowledge[];
    },
  });
}

export function useUploadBehavioralBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, titulo, autor, descricao, empresa }: {
      file: File;
      titulo: string;
      autor?: string;
      descricao?: string;
      empresa: string;
    }) => {
      const filePath = `${empresa}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('behavioral-books')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('behavioral_knowledge' as any)
        .insert({
          empresa,
          titulo,
          autor: autor || null,
          descricao: descricao || null,
          storage_path: filePath,
          nome_arquivo: file.name,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BehavioralKnowledge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-knowledge'] });
    },
  });
}

export function useToggleBehavioralBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('behavioral_knowledge' as any)
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-knowledge'] });
    },
  });
}

export function useDeleteBehavioralBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string | null }) => {
      // Delete embeddings
      await supabase.from('knowledge_embeddings' as any)
        .delete()
        .eq('source_type', 'behavioral')
        .eq('source_id', id);
      // Delete record
      const { error } = await supabase
        .from('behavioral_knowledge' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      // Delete file only if it still exists in storage
      if (storagePath) {
        await supabase.storage.from('behavioral-books').remove([storagePath]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-knowledge'] });
    },
  });
}

export function useEmbedBehavioralBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookId: string) => {
      const { data, error } = await supabase.functions.invoke('knowledge-embed', {
        body: { action: 'embed_behavioral', source_id: bookId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-knowledge'] });
    },
  });
}
