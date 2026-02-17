import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, UserCheck, ArrowLeftRight, UserCog, Headset, ExternalLink } from 'lucide-react';
import { useConversationTakeover } from '@/hooks/useConversationMode';
import { useChannelConfig } from '@/hooks/useChannelConfig';
import { supabase } from '@/integrations/supabase/client';
import { buildBluechatDeepLink } from '@/utils/bluechat';
import { toast } from '@/hooks/use-toast';
import type { AtendimentoModo } from '@/types/conversas';

interface BlueChatAgent {
  id: string;
  name: string;
}

interface ConversationTakeoverBarProps {
  leadId: string;
  empresa: string;
  telefone?: string | null;
  modo: AtendimentoModo;
  assumidoPorNome?: string | null;
  isLoading?: boolean;
  bluechatConversationId?: string | null;
}

export function ConversationTakeoverBar({
  leadId,
  empresa,
  telefone,
  modo,
  assumidoPorNome,
  isLoading,
  bluechatConversationId,
}: ConversationTakeoverBarProps) {
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; nome: string }[]>([]);
  const [blueChatAgents, setBlueChatAgents] = useState<BlueChatAgent[]>([]);
  const [bluechatTicketId, setBluechatTicketId] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [transferring, setTransferring] = useState(false);
  const takeover = useConversationTakeover();
  const { isBluechat } = useChannelConfig(empresa);

  const isManual = modo === 'MANUAL';

  // Buscar dono do lead
  useEffect(() => {
    async function fetchOwner() {
      const { data } = await supabase
        .from('lead_contacts')
        .select('owner_id')
        .eq('lead_id', leadId)
        .eq('empresa', empresa as 'TOKENIZA' | 'BLUE')
        .maybeSingle();

      if (data?.owner_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', data.owner_id)
          .maybeSingle();
        setOwnerName(profile?.nome || null);
      } else {
        setOwnerName(null);
      }
    }
    fetchOwner();
  }, [leadId, empresa]);

  // Carregar dados ao abrir dialog de transferência
  const loadTransferData = async () => {
    const profilesPromise = supabase
      .from('profiles')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setUsers(data || []));

    const ticketPromise = supabase
      .from('lead_conversation_state')
      .select('framework_data')
      .eq('lead_id', leadId)
      .eq('empresa', empresa as 'TOKENIZA' | 'BLUE')
      .maybeSingle()
      .then(({ data }) => {
        const fd = data?.framework_data as Record<string, unknown> | null;
        const ticketId = (fd?.bluechat_ticket_id as string) || (fd?.bluechat_conversation_id as string) || null;
        setBluechatTicketId(ticketId);
        return ticketId;
      });

    const agentsPromise = supabase.functions
      .invoke('bluechat-proxy', {
        body: { action: 'list-agents', empresa },
      })
      .then(({ data, error }) => {
        if (error || !data?.agents) {
          setBlueChatAgents([]);
        } else {
          setBlueChatAgents(data.agents);
        }
      })
      .catch(() => setBlueChatAgents([]));

    await Promise.all([profilesPromise, ticketPromise, agentsPromise]);
  };

  const handleTakeover = () => {
    takeover.mutate(
      { leadId, empresa, acao: isManual ? 'DEVOLVER' : 'ASSUMIR' },
      {
        onSuccess: () => {
          setOpen(false);
          // In Blue Chat mode, open Blue Chat on "Assumir"
          if (!isManual && isBluechat) {
            const deepLink = buildBluechatDeepLink(empresa, telefone || '');
            if (deepLink) {
              window.open(deepLink, '_blank');
            }
          }
        },
        onError: () => setOpen(false),
      }
    );
  };

  const handleTransfer = async () => {
    if (!selectedValue) return;
    setTransferring(true);

    try {
      if (selectedValue.startsWith('bluechat:')) {
        const agentId = selectedValue.replace('bluechat:', '');
        if (!bluechatTicketId) {
          toast({ title: 'Erro', description: 'Lead sem ticket ativo no Blue Chat', variant: 'destructive' });
          return;
        }

        const { data, error } = await supabase.functions.invoke('bluechat-proxy', {
          body: {
            action: 'transfer-ticket',
            empresa,
            ticket_id: bluechatTicketId,
            agent_id: agentId,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || 'Falha na transferência');
        }

        const agent = blueChatAgents.find((a) => a.id === agentId);
        toast({
          title: 'Transferido',
          description: `Ticket transferido para ${agent?.name || agentId} no Blue Chat`,
        });
      } else {
        const userId = selectedValue.replace('amelia:', '');
        const { error } = await supabase
          .from('lead_contacts')
          .update({ owner_id: userId })
          .eq('lead_id', leadId)
          .eq('empresa', empresa as 'TOKENIZA' | 'BLUE');

        if (error) throw error;

        const selected = users.find((u) => u.id === userId);
        setOwnerName(selected?.nome || null);
        toast({ title: 'Transferido', description: `Lead transferido para ${selected?.nome}` });
      }
      setTransferOpen(false);
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao transferir',
        variant: 'destructive',
      });
    } finally {
      setTransferring(false);
    }
  };

  const hasBlueChatSection = blueChatAgents.length > 0 || bluechatTicketId !== null;

  // Blue Chat mode labels
  const takeoverLabel = isManual
    ? 'Devolver à Amélia'
    : isBluechat
      ? 'Assumir no Blue Chat'
      : 'Assumir atendimento';

  const takeoverDescription = isManual
    ? 'A Amélia voltará a responder automaticamente este lead. Você pode reassumir a qualquer momento.'
    : isBluechat
      ? 'A Amélia parará de responder automaticamente. Você será redirecionado para o Blue Chat para atender este lead.'
      : 'A Amélia parará de responder automaticamente. Você será responsável por este atendimento.';

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
        isManual ? 'bg-primary/5 border-primary/20' : 'bg-accent/30 border-accent/20'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {isManual ? (
          <UserCheck className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-accent-foreground" />
        )}
        <Badge variant={isManual ? 'default' : 'secondary'} className="text-xs">
          {isManual ? 'Modo Manual' : 'SDR IA Ativo'}
        </Badge>
        {isBluechat && (
          <Badge variant="outline" className="text-xs gap-1">
            <Headset className="h-3 w-3" />
            Blue Chat
          </Badge>
        )}
        {isManual && assumidoPorNome && (
          <span className="text-xs text-muted-foreground">por {assumidoPorNome}</span>
        )}
        {ownerName && (
          <span className="text-xs text-muted-foreground">• Dono: {ownerName}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Botão Transferir */}
        <AlertDialog
          open={transferOpen}
          onOpenChange={(v) => {
            setTransferOpen(v);
            if (v) {
              setSelectedValue('');
              loadTransferData();
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <UserCog className="h-3.5 w-3.5" />
              Transferir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Transferir lead</AlertDialogTitle>
              <AlertDialogDescription>
                Selecione o novo responsável por este lead.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Select value={selectedValue} onValueChange={setSelectedValue}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um destinatário" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Usuários Amélia</SelectLabel>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={`amelia:${u.id}`}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>

                {hasBlueChatSection && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="flex items-center gap-1.5">
                        <Headset className="h-3.5 w-3.5" />
                        Atendentes Blue Chat
                      </SelectLabel>
                      {blueChatAgents.length > 0 ? (
                        blueChatAgents.map((a) => (
                          <SelectItem
                            key={a.id}
                            value={`bluechat:${a.id}`}
                            disabled={!bluechatTicketId}
                          >
                            {a.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__no_agents__" disabled>
                          {bluechatTicketId
                            ? 'Nenhum atendente disponível'
                            : 'Lead sem conversa ativa no Blue Chat'}
                        </SelectItem>
                      )}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleTransfer}
                disabled={!selectedValue || selectedValue === '__no_agents__' || transferring}
              >
                {transferring ? 'Transferindo...' : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Botão Assumir/Devolver */}
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || takeover.isPending}
              className="gap-1.5"
            >
              {isBluechat && !isManual ? (
                <ExternalLink className="h-3.5 w-3.5" />
              ) : (
                <ArrowLeftRight className="h-3.5 w-3.5" />
              )}
              {takeoverLabel}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isManual ? 'Devolver à Amélia?' : isBluechat ? 'Assumir no Blue Chat?' : 'Assumir atendimento?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {takeoverDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleTakeover} disabled={takeover.isPending}>
                {takeover.isPending ? 'Processando...' : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
