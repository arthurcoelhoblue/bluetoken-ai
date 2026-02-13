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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, UserCheck, ArrowLeftRight, UserCog } from 'lucide-react';
import { useConversationTakeover } from '@/hooks/useConversationMode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { AtendimentoModo } from '@/types/conversas';

interface ConversationTakeoverBarProps {
  leadId: string;
  empresa: string;
  modo: AtendimentoModo;
  assumidoPorNome?: string | null;
  isLoading?: boolean;
}

export function ConversationTakeoverBar({
  leadId,
  empresa,
  modo,
  assumidoPorNome,
  isLoading,
}: ConversationTakeoverBarProps) {
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; nome: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [transferring, setTransferring] = useState(false);
  const takeover = useConversationTakeover();

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

  // Buscar usuários para transferência
  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome')
      .order('nome');
    setUsers(data || []);
  };

  const handleTakeover = () => {
    takeover.mutate(
      { leadId, empresa, acao: isManual ? 'DEVOLVER' : 'ASSUMIR' },
      { onSettled: () => setOpen(false) }
    );
  };

  const handleTransfer = async () => {
    if (!selectedUserId) return;
    setTransferring(true);
    try {
      const { error } = await supabase
        .from('lead_contacts')
        .update({ owner_id: selectedUserId })
        .eq('lead_id', leadId)
        .eq('empresa', empresa as 'TOKENIZA' | 'BLUE');

      if (error) throw error;

      const selected = users.find(u => u.id === selectedUserId);
      setOwnerName(selected?.nome || null);
      toast({ title: 'Transferido', description: `Lead transferido para ${selected?.nome}` });
      setTransferOpen(false);
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao transferir lead', variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
      isManual 
        ? 'bg-primary/5 border-primary/20' 
        : 'bg-accent/30 border-accent/20'
    }`}>
      <div className="flex items-center gap-2 flex-wrap">
        {isManual ? (
          <UserCheck className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-accent-foreground" />
        )}
        <Badge variant={isManual ? 'default' : 'secondary'} className="text-xs">
          {isManual ? 'Modo Manual' : 'SDR IA Ativo'}
        </Badge>
        {isManual && assumidoPorNome && (
          <span className="text-xs text-muted-foreground">
            por {assumidoPorNome}
          </span>
        )}
        {ownerName && (
          <span className="text-xs text-muted-foreground">
            • Dono: {ownerName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Botão Transferir */}
        <AlertDialog open={transferOpen} onOpenChange={(v) => {
          setTransferOpen(v);
          if (v) loadUsers();
        }}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
            >
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
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleTransfer} disabled={!selectedUserId || transferring}>
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
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {isManual ? 'Devolver à Amélia' : 'Assumir atendimento'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isManual ? 'Devolver à Amélia?' : 'Assumir atendimento?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isManual
                  ? 'A Amélia voltará a responder automaticamente este lead. Você pode reassumir a qualquer momento.'
                  : 'A Amélia parará de responder automaticamente. Você será responsável por este atendimento.'}
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
