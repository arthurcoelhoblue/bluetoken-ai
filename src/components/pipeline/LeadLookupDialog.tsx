import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Bot, ExternalLink, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LeadLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onContinueToDeal: () => void;
}

interface LookupResult {
  hasConversation: boolean;
  leadId: string | null;
  contactId: string | null;
  contactNome: string | null;
  contactTelefone: string | null;
  contactEmail: string | null;
  empresa: string | null;
  ultimaMensagem: string | null;
  totalMensagens: number;
}

export function LeadLookupDialog({ open, onOpenChange, dealId, onContinueToDeal }: LeadLookupDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [triggeringAmelia, setTriggeringAmelia] = useState(false);

  useEffect(() => {
    if (!open || !dealId) return;
    setLoading(true);
    setResult(null);

    (async () => {
      try {
        // Buscar o deal com o contato
        const { data: deal } = await supabase
          .from('deals')
          .select('contact_id, contacts(id, nome, telefone, email, legacy_lead_id, empresa)')
          .eq('id', dealId)
          .single();

        if (!deal?.contacts) {
          setResult({ hasConversation: false, leadId: null, contactId: null, contactNome: null, contactTelefone: null, contactEmail: null, empresa: null, ultimaMensagem: null, totalMensagens: 0 });
          setLoading(false);
          return;
        }

        const contact = deal.contacts as Record<string, unknown>;
        const contactId = contact.id as string;
        const contactNome = contact.nome as string | null;
        const contactTelefone = contact.telefone as string | null;
        const contactEmail = contact.email as string | null;
        const legacyLeadId = contact.legacy_lead_id as string | null;
        const empresa = contact.empresa as string | null;

        // Verificar se existe conversa via lead_messages
        let hasConversation = false;
        let ultimaMensagem: string | null = null;
        let totalMensagens = 0;

        if (legacyLeadId) {
          const { count } = await supabase
            .from('lead_messages')
            .select('id', { count: 'exact', head: true })
            .eq('lead_id', legacyLeadId);

          totalMensagens = count || 0;
          hasConversation = totalMensagens > 0;

          if (hasConversation) {
            const { data: lastMsg } = await supabase
              .from('lead_messages')
              .select('conteudo, created_at')
              .eq('lead_id', legacyLeadId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            ultimaMensagem = lastMsg?.conteudo as string | null;
          }
        }

        setResult({
          hasConversation,
          leadId: legacyLeadId,
          contactId,
          contactNome,
          contactTelefone,
          contactEmail,
          empresa,
          ultimaMensagem,
          totalMensagens,
        });
      } catch (err) {
        console.error('Erro no lookup:', err);
        setResult({ hasConversation: false, leadId: null, contactId: null, contactNome: null, contactTelefone: null, contactEmail: null, empresa: null, ultimaMensagem: null, totalMensagens: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, dealId]);

  const handleGoToConversation = () => {
    if (result?.leadId) {
      onOpenChange(false);
      navigate(`/conversas?lead=${result.leadId}`);
    }
  };

  const handleTriggerAmelia = async () => {
    if (!result?.leadId || !result?.empresa || !result?.contactTelefone) {
      toast.error('Lead sem telefone cadastrado. Não é possível iniciar qualificação automática.');
      return;
    }

    setTriggeringAmelia(true);
    try {
      // Criar um lead_conversation_state se não existir e disparar a primeira mensagem
      await supabase.from('lead_conversation_state').upsert({
        lead_id: result.leadId,
        empresa: result.empresa,
        modo: 'AUTOMATICO',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id,empresa' });

      // Chamar a edge function para disparar a primeira mensagem da cadência
      const resp = await supabase.functions.invoke('cadence-runner', {
        body: {
          lead_id: result.leadId,
          empresa: result.empresa,
          force_start: true,
        },
      });

      if (resp.error) throw resp.error;

      toast.success('Amélia iniciou a qualificação do lead!');
      onOpenChange(false);
      onContinueToDeal();
    } catch (err) {
      console.error('Erro ao disparar Amélia:', err);
      toast.error('Erro ao iniciar qualificação. Tente novamente.');
    } finally {
      setTriggeringAmelia(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verificação de Lead</DialogTitle>
          <DialogDescription>
            Verificando se este lead já possui conversas no sistema.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Verificando...</span>
          </div>
        ) : result ? (
          <div className="space-y-4">
            {/* Info do contato */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="font-medium text-sm">{result.contactNome || 'Contato sem nome'}</p>
              {result.contactTelefone && (
                <p className="text-xs text-muted-foreground">{result.contactTelefone}</p>
              )}
              {result.contactEmail && (
                <p className="text-xs text-muted-foreground">{result.contactEmail}</p>
              )}
            </div>

            {result.hasConversation ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {result.totalMensagens} mensagens encontradas
                  </Badge>
                </div>
                {result.ultimaMensagem && (
                  <div className="bg-muted/30 rounded p-2">
                    <p className="text-[11px] text-muted-foreground mb-1">Última mensagem:</p>
                    <p className="text-xs line-clamp-2">{result.ultimaMensagem}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                  <UserPlus className="h-3 w-3 mr-1" />
                  Nenhuma conversa encontrada
                </Badge>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {result?.hasConversation ? (
            <>
              <Button onClick={handleGoToConversation} className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                Ir para Conversa
              </Button>
              <Button variant="outline" onClick={() => { onOpenChange(false); onContinueToDeal(); }} className="w-full">
                Abrir Deal
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleTriggerAmelia}
                disabled={triggeringAmelia || !result?.contactTelefone}
                className="w-full gap-2"
              >
                {triggeringAmelia ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                Amélia Iniciar Qualificação
              </Button>
              <Button variant="outline" onClick={() => { onOpenChange(false); onContinueToDeal(); }} className="w-full">
                Abrir Deal Direto
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
