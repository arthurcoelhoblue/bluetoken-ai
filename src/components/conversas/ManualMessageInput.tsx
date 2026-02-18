import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, AlertCircle, ExternalLink } from 'lucide-react';
import { useSendManualMessage } from '@/hooks/useConversationMode';
import { useChannelConfig } from '@/hooks/useChannelConfig';
import { buildBluechatDeepLink } from '@/utils/bluechat';
import { supabase } from '@/integrations/supabase/client';
import { CreateDealFromConversationDialog } from './CreateDealFromConversationDialog';
import type { AtendimentoModo } from '@/types/conversas';

interface ManualMessageInputProps {
  leadId: string;
  empresa: string;
  telefone?: string | null;
  modo: AtendimentoModo;
  bluechatConversationId?: string | null;
}

export function ManualMessageInput({
  leadId,
  empresa,
  telefone,
  modo,
  bluechatConversationId,
}: ManualMessageInputProps) {
  const [text, setText] = useState('');
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMutation = useSendManualMessage();
  const { isBluechat } = useChannelConfig(empresa);

  // Resolve contact_id from lead_id
  const { data: contact } = useQuery({
    queryKey: ['lead-contact-bridge', leadId, empresa],
    enabled: !!leadId,
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, nome')
        .eq('legacy_lead_id', leadId)
        .eq('empresa', empresa as 'BLUE' | 'TOKENIZA')
        .maybeSingle();
      return data;
    },
  });

  // Check if contact has an open deal
  const { data: existingDeals = [], refetch: refetchDeals } = useQuery({
    queryKey: ['lead-has-deal', contact?.id],
    enabled: !!contact?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('id')
        .eq('contact_id', contact!.id)
        .eq('status', 'ABERTO')
        .limit(1);
      return data ?? [];
    },
  });

  const hasDeal = existingDeals.length > 0;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const doSend = (message: string) => {
    if (!message || !telefone) return;
    sendMutation.mutate(
      {
        leadId,
        empresa,
        telefone,
        conteudo: message,
        modoAtual: modo,
        bluechatConversationId: bluechatConversationId || undefined,
      },
      { onSuccess: () => setText('') }
    );
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !telefone) return;

    // If contact exists but has no deal, require deal creation first
    if (contact && !hasDeal) {
      setPendingMessage(trimmed);
      setDealDialogOpen(true);
      return;
    }

    doSend(trimmed);
  };

  const handleDealCreated = (_dealId: string) => {
    refetchDeals();
    if (pendingMessage) {
      doSend(pendingMessage);
      setPendingMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenBluechat = () => {
    const deepLink = buildBluechatDeepLink(empresa, telefone || '', bluechatConversationId);
    if (deepLink) {
      window.open(deepLink, '_blank');
    }
  };

  if (!telefone) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground bg-muted/50 rounded-lg">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Telefone não disponível — não é possível enviar mensagem.
      </div>
    );
  }

  // ── Blue Chat mode: show link to Blue Chat + optional send via API ──
  if (isBluechat) {
    const deepLink = buildBluechatDeepLink(empresa, telefone || '', bluechatConversationId);

    return (
      <>
        <div className="space-y-2">
          {deepLink && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={handleOpenBluechat}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Responder no Blue Chat
            </Button>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enviar via Blue Chat..."
              className="min-h-[40px] max-h-[120px] resize-none flex-1"
              rows={1}
              disabled={sendMutation.isPending}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!text.trim() || sendMutation.isPending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {contact && (
          <CreateDealFromConversationDialog
            open={dealDialogOpen}
            onOpenChange={setDealDialogOpen}
            contactId={contact.id}
            contactNome={contact.nome ?? ''}
            empresa={empresa}
            onDealCreated={handleDealCreated}
          />
        )}
      </>
    );
  }

  // ── Mensageria mode: existing behavior ──
  const isSDR = modo === 'SDR_IA';
  const placeholder = isSDR
    ? 'Enviar e assumir atendimento...'
    : 'Digite sua mensagem...';

  return (
    <>
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[40px] max-h-[120px] resize-none flex-1"
          rows={1}
          disabled={sendMutation.isPending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {contact && (
        <CreateDealFromConversationDialog
          open={dealDialogOpen}
          onOpenChange={setDealDialogOpen}
          contactId={contact.id}
          contactNome={contact.nome ?? ''}
          empresa={empresa}
          onDealCreated={handleDealCreated}
        />
      )}
    </>
  );
}
