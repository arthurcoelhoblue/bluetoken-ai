import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Clock, Trophy, XCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useCloseDeal, useLossCategories } from '@/hooks/useDeals';
import { supabase } from '@/integrations/supabase/client';
import type { DealWithRelations, PipelineStage } from '@/types/deal';

const tempColors: Record<string, string> = {
  QUENTE: 'bg-destructive/15 text-destructive border-destructive/30',
  MORNO: 'bg-warning/15 text-warning border-warning/30',
  FRIO: 'bg-muted text-muted-foreground border-border',
};

const statusBadge: Record<string, string> = {
  GANHO: 'bg-success/15 text-success border-success/30',
  PERDIDO: 'bg-destructive/15 text-destructive border-destructive/30',
};

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function daysInStage(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

interface DealCardProps {
  deal: DealWithRelations;
  overlay?: boolean;
  currentStage?: PipelineStage;
  onDealClick?: (dealId: string) => void;
}

export function DealCard({ deal, overlay, currentStage, onDealClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: 'deal', deal },
  });

  const closeDeal = useCloseDeal();
  const { data: lossCategories = [] } = useLossCategories();
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState('');
  const [categoriaPerda, setCategoriaPerda] = useState('');

  const isClosed = deal.status === 'GANHO' || deal.status === 'PERDIDO';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : isClosed ? 0.6 : 1,
  };

  const days = daysInStage(deal.updated_at);

  const checkMinTime = async (): Promise<boolean> => {
    if (!currentStage?.tempo_minimo_dias) return true;

    const { data: history } = await supabase
      .from('deal_stage_history')
      .select('created_at')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastEntry = history?.[0]?.created_at ?? deal.created_at;
    const daysInCurrentStage = (Date.now() - new Date(lastEntry).getTime()) / 86400000;

    if (daysInCurrentStage < currentStage.tempo_minimo_dias) {
      const remaining = Math.ceil(currentStage.tempo_minimo_dias - daysInCurrentStage);
      toast.error(`Tempo mínimo não atingido. Faltam ${remaining} dia(s) neste stage.`);
      return false;
    }
    return true;
  };

  const handleWin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClosed) return;
    closeDeal.mutate({
      dealId: deal.id,
      status: 'GANHO',
      stageId: deal.stage_id,
    });
  };

  const handleLoseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClosed) return;
    setLossDialogOpen(true);
  };

  const handleConfirmLoss = async () => {
    if (!motivoPerda.trim()) {
      toast.error('Informe o motivo da perda');
      return;
    }
    if (!categoriaPerda) {
      toast.error('Selecione a categoria da perda');
      return;
    }
    if (categoriaPerda !== 'PRODUTO_INADEQUADO') {
      const ok = await checkMinTime();
      if (!ok) return;
    }
    closeDeal.mutate(
      {
        dealId: deal.id,
        status: 'PERDIDO',
        stageId: deal.stage_id,
        motivo_perda: motivoPerda.trim(),
        categoria_perda_closer: categoriaPerda,
      },
      {
        onSuccess: () => {
          // Fire-and-forget AI analysis
          supabase.functions.invoke('deal-loss-analysis', {
            body: { deal_id: deal.id },
          }).catch(console.error);
          toast.info('Análise da IA em andamento...');
        },
      }
    );
    setLossDialogOpen(false);
    setMotivoPerda('');
    setCategoriaPerda('');
  };

  return (
    <>
      <Card
        ref={overlay ? undefined : setNodeRef}
        style={overlay ? undefined : style}
        {...(overlay ? {} : { ...attributes, ...listeners })}
        className={`p-3 cursor-grab active:cursor-grabbing space-y-2 hover:shadow-md transition-shadow border-border/60 ${isClosed ? 'ring-1 ring-muted' : ''}`}
        onClick={() => onDealClick?.(deal.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-sm leading-tight line-clamp-2">{deal.titulo}</span>
          <div className="flex items-center gap-1 shrink-0">
            {isClosed ? (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadge[deal.status] ?? ''}`}>
                {deal.status}
              </Badge>
            ) : (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tempColors[deal.temperatura] ?? ''}`}>
                {deal.temperatura}
              </Badge>
            )}
          </div>
        </div>

        {deal.contacts && (
          <p className="text-xs text-muted-foreground truncate">{deal.contacts.nome}</p>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <DollarSign className="h-3 w-3" />
            {formatBRL(deal.valor ?? 0)}
          </span>
          <div className="flex items-center gap-2">
            {deal.score_probabilidade > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`flex items-center gap-0.5 font-medium ${
                    deal.score_probabilidade > 70 ? 'text-success' :
                    deal.score_probabilidade >= 40 ? 'text-warning' : 'text-destructive'
                  }`}>
                    <TrendingUp className="h-3 w-3" />
                    {deal.score_probabilidade}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>Probabilidade de fechamento</TooltipContent>
              </Tooltip>
            )}
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {days}d
            </span>
          </div>
        </div>

        {deal.owner && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
            <Avatar className="h-5 w-5">
              <AvatarImage src={deal.owner.avatar_url ?? ''} />
              <AvatarFallback className="text-[9px]">
                {(deal.owner.nome ?? deal.owner.email)?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate">
              {deal.owner.nome ?? deal.owner.email}
            </span>
          </div>
        )}

        {/* Win/Lose actions */}
        {!isClosed && (
          <div className="flex items-center gap-1 pt-1 border-t border-border/40">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-success hover:text-success hover:bg-success/10"
                  onClick={handleWin}
                  disabled={closeDeal.isPending}
                >
                  <Trophy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marcar como Ganho</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLoseClick}
                  disabled={closeDeal.isPending}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marcar como Perdido</TooltipContent>
            </Tooltip>
          </div>
        )}
      </Card>

      <Dialog open={lossDialogOpen} onOpenChange={setLossDialogOpen}>
        <DialogContent onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Motivo da Perda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={categoriaPerda} onValueChange={setCategoriaPerda}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {lossCategories.map(c => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição do motivo *</Label>
              <Textarea
                placeholder="Descreva o motivo da perda deste deal..."
                value={motivoPerda}
                onChange={e => setMotivoPerda(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmLoss} disabled={closeDeal.isPending}>
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
