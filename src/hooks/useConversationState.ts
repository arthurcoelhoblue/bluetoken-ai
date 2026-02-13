import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ConversationState, 
  EstadoFunil, 
  FrameworkAtivo, 
  FrameworkData,
  PerfilDISC 
} from '@/types/conversation';

interface UseConversationStateOptions {
  leadId: string;
  empresa: 'TOKENIZA' | 'BLUE';
  enabled?: boolean;
}

export function useConversationState({ leadId, empresa, enabled = true }: UseConversationStateOptions) {
  return useQuery({
    queryKey: ['conversation-state', leadId, empresa],
    queryFn: async (): Promise<ConversationState | null> => {
      const { data, error } = await supabase
        .from('lead_conversation_state')
        .select('*')
        .eq('lead_id', leadId)
        .eq('empresa', empresa)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Mapear para o tipo ConversationState
      return {
        id: data.id,
        lead_id: data.lead_id,
        empresa: data.empresa as 'TOKENIZA' | 'BLUE',
        canal: data.canal as 'WHATSAPP' | 'EMAIL',
        estado_funil: data.estado_funil as EstadoFunil,
        framework_ativo: data.framework_ativo as FrameworkAtivo,
        framework_data: (data.framework_data || {}) as FrameworkData,
        perfil_disc: data.perfil_disc as PerfilDISC | null,
        idioma_preferido: data.idioma_preferido as 'PT' | 'EN' | 'ES',
        ultima_pergunta_id: data.ultima_pergunta_id,
        ultimo_contato_em: data.ultimo_contato_em,
        created_at: data.created_at,
        updated_at: data.updated_at,
        modo: (data.modo as 'SDR_IA' | 'MANUAL' | 'HIBRIDO') || 'SDR_IA',
        assumido_por: data.assumido_por || null,
        assumido_em: data.assumido_em || null,
        devolvido_em: data.devolvido_em || null,
      };
    },
    enabled: enabled && !!leadId && !!empresa,
  });
}
