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
        .eq('empresa', empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA');

      if (stateError) throw stateError;

      if (acao === 'ASSUMIR') {
        const { data: leadContact } = await supabase
          .from('lead_contacts')
          .select('id, owner_id')
          .eq('lead_id', leadId)
          .eq('empresa', empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA')
          .maybeSingle();
        
        if (leadContact && !leadContact.owner_id) {
          await supabase
            .from('lead_contacts')
            .update({ owner_id: user.id })
            .eq('id', leadContact.id);
        }
      }

      const { error: logError } = await supabase
        .from('conversation_takeover_log')
        .insert({
          lead_id: leadId,
          empresa: empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
          acao,
          user_id: user.id,
          motivo: motivo || null,
        });

      if (logError) throw logError;

      // When returning to SDR_IA, find the last unanswered inbound message and reprocess it
      if (acao === 'DEVOLVER') {
        try {
          // Find the last inbound message that was interpreted but not responded to
          const { data: lastUnanswered } = await supabase
            .from('lead_message_intents')
            .select('message_id')
            .eq('lead_id', leadId)
            .eq('empresa', empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA')
            .is('resposta_enviada_em', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastUnanswered?.message_id) {
            // Trigger reprocessing so Amélia responds with full context
            await supabase.functions.invoke('sdr-ia-interpret', {
              body: {
                messageId: lastUnanswered.message_id,
                reprocess: true,
                source: 'WHATSAPP',
              },
            });
          }
        } catch (reprocessError) {
          // Don't fail the takeover if reprocessing fails
          console.error('Reprocess after devolver failed:', reprocessError);
        }
      }
    },
    onSuccess: (_, { acao }) => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-state'] });
      toast({
        title: acao === 'ASSUMIR' ? 'Atendimento assumido' : 'Devolvido à Amélia',
        description: acao === 'ASSUMIR' 
          ? 'Você assumiu o atendimento. A Amélia não enviará respostas automáticas.'
          : 'A Amélia retomou o atendimento e já está respondendo ao lead.',
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
  leadId?: string;
  contactId?: string;
  empresa: string;
  telefone: string;
  conteudo: string;
  modoAtual?: AtendimentoModo;
  mediaType?: string;
  mediaUrl?: string;
}

export function useSendManualMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const takeover = useConversationTakeover();

  return useMutation({
    mutationFn: async ({ leadId, contactId, empresa, telefone, conteudo, modoAtual, mediaType, mediaUrl }: SendManualParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      if (leadId && modoAtual !== 'MANUAL') {
        await takeover.mutateAsync({
          leadId,
          empresa,
          acao: 'ASSUMIR',
          motivo: 'Auto-takeover ao enviar mensagem manual',
        });
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          ...(leadId ? { leadId } : {}),
          ...(contactId ? { contactId } : {}),
          telefone,
          mensagem: conteudo,
          empresa,
          ...(mediaType && mediaUrl ? { mediaType, mediaUrl } : {}),
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
      const is24h = error.message?.includes('24h');
      if (!is24h) {
        toast({
          title: 'Erro ao enviar',
          description: error.message,
          variant: 'destructive',
        });
      }
    },
  });
}
