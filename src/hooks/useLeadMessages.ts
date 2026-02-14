import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LeadMessageWithContext, MensagemDirecao, MensagemEstado } from '@/types/messaging';
import type { EmpresaTipo } from '@/types/sgt';
import type { CanalTipo } from '@/types/cadence';

interface UseLeadMessagesOptions {
  leadId: string;
  empresa?: EmpresaTipo;
  enabled?: boolean;
}

interface UseRunMessagesOptions {
  runId: string;
  enabled?: boolean;
}

export function useLeadMessages({ leadId, empresa, enabled = true }: UseLeadMessagesOptions) {
  return useQuery({
    queryKey: ['lead-messages', leadId, empresa],
    queryFn: async () => {
      let query = supabase
        .from('lead_messages')
        .select(`
          *,
          lead_cadence_runs:run_id (
            cadences:cadence_id (
              nome
            )
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (empresa) {
        query = query.eq('empresa', empresa);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((msg): LeadMessageWithContext => ({
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
        cadencia_nome: (msg.lead_cadence_runs as unknown as { cadences?: { nome?: string } } | null)?.cadences?.nome,
      }));
    },
    enabled: enabled && !!leadId,
  });
}

export function useRunMessages({ runId, enabled = true }: UseRunMessagesOptions) {
  return useQuery({
    queryKey: ['run-messages', runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_messages')
        .select(`
          *,
          message_templates:template_codigo (
            nome
          )
        `)
        .eq('run_id', runId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((msg): LeadMessageWithContext => ({
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
        template_nome: (msg.message_templates as unknown as { nome?: string } | null)?.nome,
      }));
    },
    enabled: enabled && !!runId,
  });
}
