import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LeadContactIssueTipo =
  | 'SEM_CANAL_CONTATO'
  | 'EMAIL_PLACEHOLDER'
  | 'EMAIL_INVALIDO'
  | 'TELEFONE_LIXO'
  | 'TELEFONE_SEM_WHATSAPP'
  | 'DADO_SUSPEITO';

export type SeveridadeTipo = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface LeadContactIssue {
  id: string;
  lead_id: string;
  empresa: 'TOKENIZA' | 'BLUE';
  issue_tipo: LeadContactIssueTipo;
  severidade: SeveridadeTipo;
  mensagem: string;
  criado_em: string;
  resolvido: boolean;
  resolvido_por?: string | null;
  resolvido_em?: string | null;
}

interface UseLeadContactIssuesOptions {
  leadId: string;
  empresa: 'TOKENIZA' | 'BLUE';
  enabled?: boolean;
}

export function useLeadContactIssues({ leadId, empresa, enabled = true }: UseLeadContactIssuesOptions) {
  return useQuery({
    queryKey: ['lead-contact-issues', leadId, empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_contact_issues')
        .select('*')
        .eq('lead_id', leadId)
        .eq('empresa', empresa)
        .eq('resolvido', false)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as LeadContactIssue[];
    },
    enabled: enabled && !!leadId && !!empresa,
  });
}

export function useResolveContactIssue() {
  const resolveIssue = async (issueId: string, userId: string) => {
    const { error } = await supabase
      .from('lead_contact_issues')
      .update({
        resolvido: true,
        resolvido_por: userId,
        resolvido_em: new Date().toISOString(),
      })
      .eq('id', issueId);

    if (error) throw error;
    return true;
  };

  return { resolveIssue };
}

// Utilitários para exibição
export const ISSUE_TIPO_LABELS: Record<LeadContactIssueTipo, string> = {
  SEM_CANAL_CONTATO: 'Sem Canal de Contato',
  EMAIL_PLACEHOLDER: 'E-mail Placeholder',
  EMAIL_INVALIDO: 'E-mail Inválido',
  TELEFONE_LIXO: 'Telefone Inválido',
  TELEFONE_SEM_WHATSAPP: 'Sem WhatsApp',
  DADO_SUSPEITO: 'Dado Suspeito',
};

export const SEVERIDADE_CONFIG: Record<SeveridadeTipo, { color: string; bgColor: string }> = {
  ALTA: { color: 'text-destructive', bgColor: 'bg-destructive/10' },
  MEDIA: { color: 'text-warning', bgColor: 'bg-warning/10' },
  BAIXA: { color: 'text-muted-foreground', bgColor: 'bg-muted' },
};
