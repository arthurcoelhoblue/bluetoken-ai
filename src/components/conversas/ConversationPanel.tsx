import { useState, useEffect } from 'react';
import { ConversationView } from '@/components/messages/ConversationView';
import { ConversationTakeoverBar } from './ConversationTakeoverBar';
import { ManualMessageInput } from './ManualMessageInput';
import { EmailFromDealDialog } from '@/components/deals/EmailFromDealDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, ExternalLink, Headset } from 'lucide-react';
import { useChannelConfig } from '@/hooks/useChannelConfig';
import { supabase } from '@/integrations/supabase/client';
import { buildBluechatDeepLink } from '@/utils/bluechat';
import type { LeadMessageWithContext } from '@/types/messaging';
import type { AtendimentoModo } from '@/types/conversas';

interface ConversationPanelProps {
  leadId: string;
  empresa: string;
  telefone?: string | null;
  leadNome?: string | null;
  contactEmail?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  messages: LeadMessageWithContext[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  modo: AtendimentoModo;
  assumidoPorNome?: string | null;
  maxHeight?: string;
}

export function ConversationPanel({
  leadId,
  empresa,
  telefone,
  leadNome,
  contactEmail,
  contactId,
  dealId,
  messages,
  isLoading,
  error,
  onRetry,
  modo,
  assumidoPorNome,
  maxHeight = '400px',
}: ConversationPanelProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [bluechatConversationId, setBluechatConversationId] = useState<string | null>(null);
  const { isBluechat } = useChannelConfig(empresa);

  // Fetch bluechat_conversation_id from framework_data (kept for transfers)
  useEffect(() => {
    if (!leadId || !empresa) return;

    supabase
      .from('lead_conversation_state')
      .select('framework_data')
      .eq('lead_id', leadId)
      .eq('empresa', empresa as 'TOKENIZA' | 'BLUE')
      .maybeSingle()
      .then(({ data }) => {
        const fd = data?.framework_data as Record<string, unknown> | null;
        setBluechatConversationId(
          (fd?.bluechat_conversation_id as string) ||
          (fd?.bluechat_ticket_id as string) ||
          null
        );
      });
  }, [leadId, empresa]);

  // Use conversation ID when available for direct deep link, fallback to phone
  const bluechatDeepLink = isBluechat ? buildBluechatDeepLink(empresa, telefone || '', bluechatConversationId) : null;

  return (
    <div className="space-y-3">
      <ConversationTakeoverBar
        leadId={leadId}
        empresa={empresa}
        telefone={telefone}
        modo={modo}
        assumidoPorNome={assumidoPorNome}
        bluechatConversationId={bluechatConversationId}
      />

      {/* Blue Chat deep link badge */}
      {bluechatDeepLink && (
        <div className="flex items-center justify-end">
          <a
            href={bluechatDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Headset className="h-3 w-3" />
            Ver no Blue Chat
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      <ConversationView
        messages={messages}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        leadNome={leadNome}
        maxHeight={maxHeight}
        emptyMessage="Nenhuma mensagem enviada para este lead."
      />

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ManualMessageInput
            leadId={leadId}
            empresa={empresa}
            telefone={telefone}
            modo={modo}
            contactId={contactId}
            bluechatConversationId={bluechatConversationId}
          />
        </div>
        {contactEmail && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEmailOpen(true)}
            title="Enviar email"
            className="shrink-0"
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}
      </div>

      {contactEmail && (
        <EmailFromDealDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          dealId={dealId || ''}
          contactEmail={contactEmail}
          contactNome={leadNome || null}
        />
      )}
    </div>
  );
}
