import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { 
  ProductKnowledge, 
  KnowledgeSection, 
  KnowledgeDocument,
  KnowledgeSectionTipo 
} from "@/types/knowledge";

// Fetch all products
export function useProductKnowledgeList(empresa?: 'TOKENIZA' | 'BLUE') {
  return useQuery({
    queryKey: ['product-knowledge', empresa],
    queryFn: async () => {
      let query = supabase
        .from('product_knowledge')
        .select('*')
        .order('produto_nome');

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductKnowledge[];
    },
  });
}

// Fetch single product with sections and documents
export function useProductKnowledgeDetail(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-knowledge-detail', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID required');

      const [productRes, sectionsRes, docsRes] = await Promise.all([
        supabase
          .from('product_knowledge')
          .select('*')
          .eq('id', productId)
          .maybeSingle(),
        supabase
          .from('knowledge_sections')
          .select('*')
          .eq('product_knowledge_id', productId)
          .order('ordem'),
        supabase
          .from('knowledge_documents')
          .select('*')
          .eq('product_knowledge_id', productId)
          .order('uploaded_at', { ascending: false }),
      ]);

      if (productRes.error) throw productRes.error;
      if (sectionsRes.error) throw sectionsRes.error;
      if (docsRes.error) throw docsRes.error;

      if (!productRes.data) throw new Error('Produto não encontrado');

      return {
        ...productRes.data,
        sections: sectionsRes.data as KnowledgeSection[],
        documents: docsRes.data as KnowledgeDocument[],
      };
    },
    enabled: !!productId,
  });
}

// Create product
export function useCreateProductKnowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<ProductKnowledge, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('product_knowledge')
        .insert(product as any)
        .select()
        .single();

      if (error) throw error;
      return data as ProductKnowledge;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge'] });
    },
  });
}

// Update product
export function useUpdateProductKnowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductKnowledge> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_knowledge')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ProductKnowledge;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-detail', data.id] });
    },
  });
}

// Delete product
export function useDeleteProductKnowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_knowledge')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge'] });
    },
  });
}

// Create/Update section
export function useUpsertKnowledgeSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (section: Omit<KnowledgeSection, 'created_at' | 'updated_at'> & { id?: string }) => {
      const { id, ...data } = section;

      if (id) {
        const { data: updated, error } = await supabase
          .from('knowledge_sections')
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return updated as KnowledgeSection;
      } else {
        const { data: created, error } = await supabase
          .from('knowledge_sections')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return created as KnowledgeSection;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['product-knowledge-detail', data.product_knowledge_id] 
      });
    },
  });
}

// Delete section
export function useDeleteKnowledgeSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase
        .from('knowledge_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['product-knowledge-detail', data.productId] 
      });
    },
  });
}

// Upload document
export function useUploadKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      productId, 
      file, 
      tipoDocumento, 
      descricao 
    }: { 
      productId: string; 
      file: File; 
      tipoDocumento?: string; 
      descricao?: string;
    }) => {
      const fileName = `${productId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('product-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('knowledge_documents')
        .insert({
          product_knowledge_id: productId,
          nome_arquivo: file.name,
          storage_path: fileName,
          tipo_documento: tipoDocumento || null,
          descricao: descricao || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as KnowledgeDocument;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['product-knowledge-detail', data.product_knowledge_id] 
      });
    },
  });
}

// Delete document
export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storagePath, productId }: { 
      id: string; 
      storagePath: string; 
      productId: string;
    }) => {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('product-documents')
        .remove([storagePath]);

      if (storageError) {
        // Non-critical: DB record will still be deleted
      }

      // Delete from database
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['product-knowledge-detail', data.productId] 
      });
    },
  });
}

// Get document download URL
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('product-documents')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    return null;
  }

  return data.signedUrl;
}
