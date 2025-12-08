import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CanalTipo, EmpresaTipo, CadenceStep } from '@/types/cadence';
import { useToast } from '@/hooks/use-toast';

// Template para o select
export interface TemplateOption {
  id: string;
  codigo: string;
  nome: string;
  canal: CanalTipo;
  empresa: EmpresaTipo;
}

// Step no formulário
export interface StepFormData {
  id?: string;
  ordem: number;
  canal: CanalTipo;
  template_codigo: string;
  offset_minutos: number;
  parar_se_responder: boolean;
}

// Dados do formulário da cadência
export interface CadenceFormData {
  empresa: EmpresaTipo;
  codigo: string;
  nome: string;
  descricao: string;
  canal_principal: CanalTipo;
  ativo: boolean;
  steps: StepFormData[];
}

// Hook para carregar templates
export function useMessageTemplates(empresa?: EmpresaTipo) {
  return useQuery({
    queryKey: ['message-templates', empresa],
    queryFn: async () => {
      let query = supabase
        .from('message_templates')
        .select('id, codigo, nome, canal, empresa')
        .eq('ativo', true)
        .order('empresa')
        .order('canal')
        .order('nome');

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TemplateOption[];
    },
  });
}

// Hook para carregar cadência para edição
export function useCadenceForEdit(cadenceId?: string) {
  return useQuery({
    queryKey: ['cadence-edit', cadenceId],
    queryFn: async () => {
      if (!cadenceId) return null;

      // Buscar cadência
      const { data: cadence, error: cadenceError } = await supabase
        .from('cadences')
        .select('*')
        .eq('id', cadenceId)
        .maybeSingle();

      if (cadenceError) throw cadenceError;
      if (!cadence) throw new Error('Cadência não encontrada');

      // Buscar steps
      const { data: steps, error: stepsError } = await supabase
        .from('cadence_steps')
        .select('*')
        .eq('cadence_id', cadenceId)
        .order('ordem');

      if (stepsError) throw stepsError;

      return {
        cadence,
        steps: steps || [],
      };
    },
    enabled: !!cadenceId,
  });
}

// Hook para salvar cadência (criar ou atualizar)
export function useSaveCadence() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      cadenceId,
      data,
    }: {
      cadenceId?: string;
      data: CadenceFormData;
    }) => {
      const isEdit = !!cadenceId;

      if (isEdit) {
        // Atualizar cadência existente
        const { error: updateError } = await supabase
          .from('cadences')
          .update({
            empresa: data.empresa,
            codigo: data.codigo,
            nome: data.nome,
            descricao: data.descricao || null,
            canal_principal: data.canal_principal,
            ativo: data.ativo,
          })
          .eq('id', cadenceId);

        if (updateError) throw updateError;

        // Deletar steps antigos
        const { error: deleteError } = await supabase
          .from('cadence_steps')
          .delete()
          .eq('cadence_id', cadenceId);

        if (deleteError) throw deleteError;

        // Inserir novos steps
        if (data.steps.length > 0) {
          const stepsToInsert = data.steps.map((step, index) => ({
            cadence_id: cadenceId,
            ordem: index + 1,
            canal: step.canal,
            template_codigo: step.template_codigo,
            offset_minutos: step.offset_minutos,
            parar_se_responder: step.parar_se_responder,
          }));

          const { error: insertError } = await supabase
            .from('cadence_steps')
            .insert(stepsToInsert);

          if (insertError) throw insertError;
        }

        return { id: cadenceId, isNew: false };
      } else {
        // Criar nova cadência
        const { data: newCadence, error: createError } = await supabase
          .from('cadences')
          .insert({
            empresa: data.empresa,
            codigo: data.codigo,
            nome: data.nome,
            descricao: data.descricao || null,
            canal_principal: data.canal_principal,
            ativo: data.ativo,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Inserir steps
        if (data.steps.length > 0) {
          const stepsToInsert = data.steps.map((step, index) => ({
            cadence_id: newCadence.id,
            ordem: index + 1,
            canal: step.canal,
            template_codigo: step.template_codigo,
            offset_minutos: step.offset_minutos,
            parar_se_responder: step.parar_se_responder,
          }));

          const { error: insertError } = await supabase
            .from('cadence_steps')
            .insert(stepsToInsert);

          if (insertError) throw insertError;
        }

        return { id: newCadence.id, isNew: true };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cadences'] });
      queryClient.invalidateQueries({ queryKey: ['cadence', result.id] });
      queryClient.invalidateQueries({ queryKey: ['cadence-edit', result.id] });
      toast({
        title: result.isNew ? 'Cadência criada' : 'Cadência atualizada',
        description: result.isNew
          ? 'A nova cadência foi criada com sucesso.'
          : 'As alterações foram salvas com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Valores padrão para novo step
export function createEmptyStep(ordem: number): StepFormData {
  return {
    ordem,
    canal: 'WHATSAPP',
    template_codigo: '',
    offset_minutos: 0,
    parar_se_responder: true,
  };
}

// Valores padrão para nova cadência
export function createEmptyCadence(): CadenceFormData {
  return {
    empresa: 'TOKENIZA',
    codigo: '',
    nome: '',
    descricao: '',
    canal_principal: 'WHATSAPP',
    ativo: false,
    steps: [createEmptyStep(1)],
  };
}
