import { useState } from 'react';
import { ConversationView } from '@/components/messages/ConversationView';
import { ConversationTakeoverBar } from './ConversationTakeoverBar';
import { ManualMessageInput } from './ManualMessageInput';
import { EmailFromDealDialog } from '@/components/deals/EmailFromDealDialog';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
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
  onRefresh?: () => void;
  isRefreshing?: boolean;
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
  onRefresh,
  isRefreshing,
  modo,
  assumidoPorNome,
  maxHeight = '400px',
}: ConversationPanelProps) {
  const [emailOpen, setEmailOpen] = useState(false);

  return (
    <div className="space-y-3">
      <ConversationTakeoverBar
        leadId={leadId}
        empresa={empresa}
        telefone={telefone}
        modo={modo}
        assumidoPorNome={assumidoPorNome}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />

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
