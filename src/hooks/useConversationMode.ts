import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { AtendimentoModo, TakeoverAcao } from '@/types/conversas';

interface TakeoverParams {
  leadId: string;
  empresa: string;
  acao: TakeoverAcao;
  motivo?: string;
}

export function useConversationTakeover() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, empresa, acao, motivo }: TakeoverParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const novoModo: AtendimentoModo = acao === 'ASSUMIR' ? 'MANUAL' : 'SDR_IA';
      const now = new Date().toISOString();

      // Update conversation state
      const updateFields: Record<string, unknown> = {
        modo: novoModo,
        updated_at: now,
      };

      if (acao === 'ASSUMIR') {
        updateFields.assumido_por = user.id;
        updateFields.assumido_em = now;
      } else {
        updateFields.assumido_por = null;
        updateFields.devolvido_em = now;
      }

      const { error: stateError } = await supabase
        .from('lead_conversation_state')
        .update(updateFields)
        .eq('lead_id', leadId)
        .eq('empresa', empresa as 'TOKENIZA' | 'BLUE');

      if (stateError) throw stateError;

      // MUDANÇA 2: Auto-assign owner_id no takeover ASSUMIR
      if (acao === 'ASSUMIR') {
        const { data: leadContact } = await supabase
          .from('lead_contacts')
          .select('id, owner_id')
          .eq('lead_id', leadId)
          .eq('empresa', empresa as 'TOKENIZA' | 'BLUE')
          .maybeSingle();
        
        if (leadContact && !leadContact.owner_id) {
          await supabase
            .from('lead_contacts')
            .update({ owner_id: user.id })
            .eq('id', leadContact.id);
        }
      }

      // Insert takeover log
      const { error: logError } = await supabase
        .from('conversation_takeover_log')
        .insert({
          lead_id: leadId,
          empresa: empresa as 'TOKENIZA' | 'BLUE',
          acao,
          user_id: user.id,
          motivo: motivo || null,
        });

      if (logError) throw logError;
    },
    onSuccess: (_, { acao }) => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-state'] });
      toast({
        title: acao === 'ASSUMIR' ? 'Atendimento assumido' : 'Devolvido à Amélia',
        description: acao === 'ASSUMIR' 
          ? 'Você assumiu o atendimento. A Amélia não enviará respostas automáticas.'
          : 'A Amélia retomou o atendimento automático.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: `Falha ao alterar modo: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}

interface SendManualParams {
  leadId: string;
  empresa: string;
  telefone: string;
  conteudo: string;
  modoAtual?: AtendimentoModo;
  bluechatConversationId?: string;
}

export function useSendManualMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const takeover = useConversationTakeover();

  return useMutation({
    mutationFn: async ({ leadId, empresa, telefone, conteudo, modoAtual, bluechatConversationId }: SendManualParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Auto-takeover if not already in MANUAL
      if (modoAtual !== 'MANUAL') {
        await takeover.mutateAsync({
          leadId,
          empresa,
          acao: 'ASSUMIR',
          motivo: 'Auto-takeover ao enviar mensagem manual',
        });
      }

      // If bluechatConversationId is provided, route via bluechat-proxy
      if (bluechatConversationId) {
        const { data, error } = await supabase.functions.invoke('bluechat-proxy', {
          body: {
            action: 'send-message',
            empresa,
            conversation_id: bluechatConversationId,
            content: conteudo,
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Falha ao enviar via Blue Chat');
        return data;
      }

      // Otherwise, send via whatsapp-send (Direct mode)
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          leadId,
          telefone,
          mensagem: conteudo,
          empresa,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
