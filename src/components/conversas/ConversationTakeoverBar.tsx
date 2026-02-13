import { useState } from 'react';
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
import { Bot, UserCheck, ArrowLeftRight } from 'lucide-react';
import { useConversationTakeover } from '@/hooks/useConversationMode';
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
  const takeover = useConversationTakeover();

  const isManual = modo === 'MANUAL';

  const handleTakeover = () => {
    takeover.mutate(
      { leadId, empresa, acao: isManual ? 'DEVOLVER' : 'ASSUMIR' },
      { onSettled: () => setOpen(false) }
    );
  };

  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
      isManual 
        ? 'bg-primary/5 border-primary/20' 
        : 'bg-accent/30 border-accent/20'
    }`}>
      <div className="flex items-center gap-2">
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
      </div>

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
  );
}
