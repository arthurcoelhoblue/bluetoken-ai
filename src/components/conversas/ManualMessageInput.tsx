import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, AlertCircle, FileText, Clock } from 'lucide-react';
import { useSendManualMessage } from '@/hooks/useConversationMode';
import { supabase } from '@/integrations/supabase/client';
import { CreateDealFromConversationDialog } from './CreateDealFromConversationDialog';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import type { AtendimentoModo } from '@/types/conversas';

interface ManualMessageInputProps {
  leadId: string;
  empresa: string;
  telefone?: string | null;
  modo: AtendimentoModo;
  contactId?: string | null;
}

export function ManualMessageInput({
  leadId,
  empresa,
  telefone,
  modo,
  contactId,
}: ManualMessageInputProps) {
  const [text, setText] = useState('');
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [windowExpired, setWindowExpired] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMutation = useSendManualMessage();

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
        ...(leadId ? { leadId } : {}),
        ...(contactId ? { contactId } : {}),
        empresa,
        telefone,
        conteudo: message,
        modoAtual: modo,
      },
      {
        onSuccess: () => {
          setText('');
          setWindowExpired(false);
        },
        onError: (error) => {
          if (error.message?.includes('24h')) {
            setWindowExpired(true);
          }
        },
      }
    );
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !telefone) return;

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

  const handleTemplateSent = () => {
    setWindowExpired(false);
  };

  if (!telefone) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground bg-muted/50 rounded-lg">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Telefone não disponível — não é possível enviar mensagem.
      </div>
    );
  }

  if (!leadId && !contactId) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground bg-muted/50 rounded-lg">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Lead/Contato não vinculado — não é possível enviar mensagem por aqui.
      </div>
    );
  }

  const isSDR = modo === 'SDR_IA';
  const placeholder = isSDR
    ? 'Enviar e assumir atendimento...'
    : 'Digite sua mensagem...';

  return (
    <>
      {windowExpired && (
        <div className="flex items-center gap-2 p-3 mb-2 text-sm rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Janela de 24h expirada. Envie um template aprovado para reabrir a conversa.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => setTemplatePickerOpen(true)}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Selecionar Template
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={windowExpired ? 'Envie um template para reabrir a conversa...' : placeholder}
          className="min-h-[40px] max-h-[120px] resize-none flex-1"
          rows={1}
          disabled={sendMutation.isPending || windowExpired}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => setTemplatePickerOpen(true)}
          title="Enviar template"
          className="shrink-0"
        >
          <FileText className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending || windowExpired}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {telefone && (
        <TemplatePickerDialog
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          empresa={empresa}
          telefone={telefone}
          leadId={leadId}
          contactId={contactId ?? undefined}
          onSent={handleTemplateSent}
        />
      )}

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
