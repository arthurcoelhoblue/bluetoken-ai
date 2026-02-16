import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import type { CaptureForm, CaptureFormField, CaptureFormSettings } from '@/types/captureForms';

function useEmpresa() {
  const { activeCompany } = useCompany();
  return activeCompany;
}

export function useCaptureForms() {
  const empresa = useEmpresa();

  return useQuery({
    queryKey: ['capture-forms', empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capture_forms')
        .select('*, capture_form_submissions(count)')
        .eq('empresa', empresa)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((f) => ({
        ...f,
        fields: (f.fields as unknown as CaptureFormField[]) || [],
        settings: (f.settings as unknown as CaptureFormSettings) || {},
        submission_count: f.capture_form_submissions?.[0]?.count || 0,
      })) as CaptureForm[];
    },
  });
}

export function useCaptureForm(id: string | undefined) {
  return useQuery({
    queryKey: ['capture-form', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capture_forms')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw error;

      return {
        ...data,
        fields: (data.fields as unknown as CaptureFormField[]) || [],
        settings: (data.settings as unknown as CaptureFormSettings) || {},
      } as CaptureForm;
    },
  });
}

export function useCreateCaptureForm() {
  const qc = useQueryClient();
  const empresa = useEmpresa();

  return useMutation({
    mutationFn: async (input: { nome: string; slug: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('capture_forms')
        .insert({
          empresa,
          nome: input.nome,
          slug: input.slug,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capture-forms'] });
      toast.success('Form criado com sucesso');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCaptureForm() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CaptureForm> & { id: string }) => {
      const payload: Record<string, unknown> = {};
      if (updates.nome !== undefined) payload.nome = updates.nome;
      if (updates.slug !== undefined) payload.slug = updates.slug;
      if (updates.descricao !== undefined) payload.descricao = updates.descricao;
      if (updates.pipeline_id !== undefined) payload.pipeline_id = updates.pipeline_id;
      if (updates.stage_id !== undefined) payload.stage_id = updates.stage_id;
      if (updates.fields !== undefined) payload.fields = updates.fields;
      if (updates.settings !== undefined) payload.settings = updates.settings;
      if (updates.status !== undefined) payload.status = updates.status;

      const { error } = await supabase
        .from('capture_forms')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capture-forms'] });
      qc.invalidateQueries({ queryKey: ['capture-form'] });
      toast.success('Form atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCaptureForm() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('capture_forms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capture-forms'] });
      toast.success('Form excluído');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
