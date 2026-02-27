import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LeadMessageWithContext, MensagemDirecao, MensagemEstado, TipoMidia } from '@/types/messaging';
import type { EmpresaTipo } from '@/types/sgt';
import type { CanalTipo } from '@/types/cadence';

interface UseConversationMessagesOptions {
  leadId: string;
  contactId?: string | null;
  empresa?: EmpresaTipo;
  telefone?: string | null;
  enabled?: boolean;
}

/**
 * Hook que busca todas as mensagens de uma conversa
 * Combina mensagens por lead_id + mensagens INBOUND pelo telefone (para UNMATCHED)
 * Inclui suporte a realtime para atualizações automáticas
 */
export function useConversationMessages({ 
  leadId, 
  contactId,
  empresa, 
  telefone,
  enabled = true 
}: UseConversationMessagesOptions) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['conversation-messages', leadId, contactId, empresa, telefone],
    queryFn: async () => {
      const messages: LeadMessageWithContext[] = [];
      
      // 1. Buscar mensagens pelo lead_id (OUTBOUND + INBOUND associadas)
      let leadQuery = supabase
        .from('lead_messages')
        .select(`
          *,
          lead_cadence_runs:run_id (
            cadences:cadence_id (
              nome
            )
          )
        `)
        .eq('lead_id', leadId);
      
      if (empresa) {
        leadQuery = leadQuery.eq('empresa', empresa);
      }
      
      const { data: leadMessages, error: leadError } = await leadQuery
        .order('created_at', { ascending: true });
      
      if (leadError) throw leadError;
      
      // Adicionar mensagens do lead
      if (leadMessages) {
        for (const msg of leadMessages) {
          messages.push({
            id: msg.id,
            lead_id: msg.lead_id,
            empresa: msg.empresa as EmpresaTipo,
            run_id: msg.run_id,
            step_ordem: msg.step_ordem,
            canal: msg.canal as CanalTipo,
            direcao: msg.direcao as MensagemDirecao,
            template_codigo: msg.template_codigo,
            conteudo: msg.conteudo,
            estado: msg.estado as MensagemEstado,
            whatsapp_message_id: msg.whatsapp_message_id,
            email_message_id: msg.email_message_id,
            erro_detalhe: msg.erro_detalhe,
            enviado_em: msg.enviado_em,
            entregue_em: msg.entregue_em,
            lido_em: msg.lido_em,
            created_at: msg.created_at,
            updated_at: msg.updated_at,
            tipo_midia: ((msg as Record<string, unknown>).tipo_midia as TipoMidia) || 'text',
            media_url: (msg as Record<string, unknown>).media_url as string | null || null,
            media_mime_type: (msg as Record<string, unknown>).media_mime_type as string | null || null,
            media_filename: (msg as Record<string, unknown>).media_filename as string | null || null,
            media_caption: (msg as Record<string, unknown>).media_caption as string | null || null,
            media_meta_id: (msg as Record<string, unknown>).media_meta_id as string | null || null,
            cadencia_nome: (msg.lead_cadence_runs as { cadences?: { nome?: string } } | null)?.cadences?.nome,
          });
        }
      }
      
      // 2. Buscar mensagens por contact_id (para contatos sem legacy_lead_id)
      if (contactId) {
        const { data: contactMessages } = await supabase
          .from('lead_messages')
          .select('*')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: true });
        
        if (contactMessages) {
          const existingIds = new Set(messages.map(m => m.id));
          for (const msg of contactMessages) {
            if (!existingIds.has(msg.id)) {
              messages.push({
                id: msg.id,
                lead_id: msg.lead_id,
                empresa: msg.empresa as EmpresaTipo,
                run_id: msg.run_id,
                step_ordem: msg.step_ordem,
                canal: msg.canal as CanalTipo,
                direcao: msg.direcao as MensagemDirecao,
                template_codigo: msg.template_codigo,
                conteudo: msg.conteudo,
                estado: msg.estado as MensagemEstado,
                whatsapp_message_id: msg.whatsapp_message_id,
                email_message_id: msg.email_message_id,
                erro_detalhe: msg.erro_detalhe,
                enviado_em: msg.enviado_em,
                entregue_em: msg.entregue_em,
                lido_em: msg.lido_em,
                created_at: msg.created_at,
                updated_at: msg.updated_at,
                tipo_midia: ((msg as Record<string, unknown>).tipo_midia as TipoMidia) || 'text',
                media_url: (msg as Record<string, unknown>).media_url as string | null || null,
                media_mime_type: (msg as Record<string, unknown>).media_mime_type as string | null || null,
                media_filename: (msg as Record<string, unknown>).media_filename as string | null || null,
                media_caption: (msg as Record<string, unknown>).media_caption as string | null || null,
                media_meta_id: (msg as Record<string, unknown>).media_meta_id as string | null || null,
              });
            }
          }
        }
      }

      // 3. Buscar mensagens INBOUND UNMATCHED pelo telefone (se fornecido)
      // Isso pega mensagens que chegaram mas não foram associadas ao lead
      if (telefone) {
        // Normalizar telefone para busca (remover tudo que não é dígito)
        const phoneNormalized = telefone.replace(/\D/g, '');
        // Garantir que temos pelo menos os últimos 8 dígitos para match
        const phonePattern = phoneNormalized.slice(-8);
        
        const { data: unmatchedMessages } = await supabase
          .from('lead_messages')
          .select('*')
          .is('lead_id', null)
          .is('contact_id', null)
          .eq('direcao', 'INBOUND')
          .eq('canal', 'WHATSAPP')
          .ilike('whatsapp_message_id', `%${phonePattern}%`)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (unmatchedMessages) {
          const existingIds = new Set(messages.map(m => m.id));
          
          for (const msg of unmatchedMessages) {
            if (!existingIds.has(msg.id)) {
              messages.push({
                id: msg.id,
                lead_id: msg.lead_id,
                empresa: msg.empresa as EmpresaTipo,
                run_id: msg.run_id,
                step_ordem: msg.step_ordem,
                canal: msg.canal as CanalTipo,
                direcao: msg.direcao as MensagemDirecao,
                template_codigo: msg.template_codigo,
                conteudo: msg.conteudo,
                estado: msg.estado as MensagemEstado,
                whatsapp_message_id: msg.whatsapp_message_id,
                email_message_id: msg.email_message_id,
                erro_detalhe: msg.erro_detalhe,
                enviado_em: msg.enviado_em,
                entregue_em: msg.entregue_em,
                lido_em: msg.lido_em,
                created_at: msg.created_at,
                updated_at: msg.updated_at,
                tipo_midia: ((msg as Record<string, unknown>).tipo_midia as TipoMidia) || 'text',
                media_url: (msg as Record<string, unknown>).media_url as string | null || null,
                media_mime_type: (msg as Record<string, unknown>).media_mime_type as string | null || null,
                media_filename: (msg as Record<string, unknown>).media_filename as string | null || null,
                media_caption: (msg as Record<string, unknown>).media_caption as string | null || null,
                media_meta_id: (msg as Record<string, unknown>).media_meta_id as string | null || null,
                unmatched: true,
              });
            }
          }
        }
      }
      
      // Ordenar por data de criação
      messages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      return messages;
    },
    enabled: enabled && (!!leadId || !!contactId),
  });
  
  // Realtime subscription para novas mensagens
  useEffect(() => {
    if (!enabled || (!leadId && !contactId)) return;
    
    const channels: ReturnType<typeof supabase.channel>[] = [];
    
    // Channel 1: Mensagens associadas ao lead
    if (leadId) {
      const leadChannel = supabase
        .channel(`messages-lead-${leadId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lead_messages',
            filter: `lead_id=eq.${leadId}`,
          },
          () => {
            queryClient.invalidateQueries({ 
              queryKey: ['conversation-messages', leadId, contactId, empresa, telefone] 
            });
          }
        )
        .subscribe();
      channels.push(leadChannel);
    }
    
    // Channel 2: Mensagens associadas ao contact_id
    if (contactId) {
      const contactChannel = supabase
        .channel(`messages-contact-${contactId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lead_messages',
            filter: `contact_id=eq.${contactId}`,
          },
          () => {
            queryClient.invalidateQueries({ 
              queryKey: ['conversation-messages', leadId, contactId, empresa, telefone] 
            });
          }
        )
        .subscribe();
      channels.push(contactChannel);
    }
    
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [leadId, contactId, empresa, telefone, enabled, queryClient]);
  
  return query;
}
