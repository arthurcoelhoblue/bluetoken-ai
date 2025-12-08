import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ICP, Temperatura, Prioridade, Persona } from '@/types/classification';
import type { EmpresaTipo } from '@/types/sgt';

// ========================================
// Types
// ========================================

export interface UpdateClassificationData {
  classificationId: string;
  leadId: string;
  empresa: EmpresaTipo;
  icp: ICP;
  persona: Persona | null;
  temperatura: Temperatura;
  prioridade: Prioridade;
  override_motivo: string;
}

// ========================================
// Hook: useUpdateClassification
// ========================================

export function useUpdateClassification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: UpdateClassificationData) => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('lead_classifications')
        .update({
          icp: data.icp,
          persona: data.persona,
          temperatura: data.temperatura,
          prioridade: data.prioridade,
          origem: 'MANUAL',
          override_por_user_id: user.id,
          override_motivo: data.override_motivo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.classificationId);

      if (error) {
        console.error('Erro ao atualizar classificação:', error);
        throw error;
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['lead-classification', variables.leadId],
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-classification-detail', variables.leadId],
      });
      queryClient.invalidateQueries({
        queryKey: ['leads-with-classification'],
      });
    },
  });
}
