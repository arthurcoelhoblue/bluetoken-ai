import { ConversationView } from '@/components/messages/ConversationView';
import { ConversationTakeoverBar } from './ConversationTakeoverBar';
import { ManualMessageInput } from './ManualMessageInput';
import type { LeadMessageWithContext } from '@/types/messaging';
import type { AtendimentoModo } from '@/types/conversas';

interface ConversationPanelProps {
  leadId: string;
  empresa: string;
  telefone?: string | null;
  leadNome?: string | null;
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
  messages,
  isLoading,
  error,
  onRetry,
  modo,
  assumidoPorNome,
  maxHeight = '400px',
}: ConversationPanelProps) {
  return (
    <div className="space-y-3">
      <ConversationTakeoverBar
        leadId={leadId}
        empresa={empresa}
        modo={modo}
        assumidoPorNome={assumidoPorNome}
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

      <ManualMessageInput
        leadId={leadId}
        empresa={empresa}
        telefone={telefone}
        modo={modo}
      />
    </div>
  );
}
