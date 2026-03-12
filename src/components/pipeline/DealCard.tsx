import { useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DollarSign, Clock, TrendingUp, Sparkles, Bot } from 'lucide-react';
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

  const wasDragged = useRef(false);

  useEffect(() => {
    if (isDragging) {
      wasDragged.current = true;
    }
  }, [isDragging]);

  const isClosed = deal.status === 'GANHO' || deal.status === 'PERDIDO';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : isClosed ? 0.6 : 1,
  };

  const days = daysInStage(deal.updated_at);

  // SLA border color
  const slaMinutos = currentStage?.sla_minutos;
  const minutosNoStage = days * 24 * 60;
  const slaPct = slaMinutos ? (minutosNoStage / slaMinutos) * 100 : 0;
  const slaBorderColor = !slaMinutos ? 'border-l-transparent'
    : slaPct > 100 ? 'border-l-destructive'
    : slaPct > 75 ? 'border-l-warning'
    : 'border-l-success';

  const proximaAcao = (deal as DealWithRelations & { proxima_acao_sugerida?: string }).proxima_acao_sugerida ?? null;

  return (
    <Card
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      data-deal-card
      className={`p-2 cursor-grab active:cursor-grabbing space-y-1 hover:shadow-md transition-shadow duration-100 border-border/60 border-l-[3px] ${slaBorderColor} ${isClosed ? 'ring-1 ring-muted' : ''}`}
      onClick={() => onDealClick?.(deal.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-xs leading-tight line-clamp-1">{deal.titulo}</span>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {deal.etiqueta && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
              deal.etiqueta.toLowerCase().includes('ia') || deal.etiqueta.toLowerCase().includes('amelia')
                ? 'bg-violet-500/15 text-violet-600 border-violet-500/30'
                : 'bg-blue-500/15 text-blue-600 border-blue-500/30'
            }`}>
              {(deal.etiqueta.toLowerCase().includes('ia') || deal.etiqueta.toLowerCase().includes('amelia')) && <Bot className="h-3 w-3 mr-0.5" />}
              {deal.etiqueta}
            </Badge>
          )}
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
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground truncate">{deal.contacts.nome}</p>
          <span className="text-[9px] text-muted-foreground/70 shrink-0 ml-1">
            {new Date(deal.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px]">
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
          <span className={`flex items-center gap-1 ${
            slaMinutos && slaPct > 100 ? 'text-destructive font-medium' :
            slaMinutos && slaPct > 75 ? 'text-warning' : 'text-muted-foreground'
          }`}>
            <Clock className="h-3 w-3" />
            {days}d
          </span>
        </div>
      </div>

      {deal.owner && (
        <div className="flex items-center gap-1 pt-0.5 border-t border-border/40">
          <Avatar className="h-4 w-4">
            <AvatarImage src={deal.owner.avatar_url ?? ''} />
            <AvatarFallback className="text-[8px]">
              {(deal.owner.nome ?? deal.owner.email)?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground truncate">
            {deal.owner.nome ?? deal.owner.email}
          </span>
        </div>
      )}

      {/* Proxima acao sugerida footer */}
      {proximaAcao && !isClosed && (
        <div className="pt-0.5 border-t border-border/40">
          <p className="text-[10px] italic text-muted-foreground line-clamp-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary shrink-0" />
            {proximaAcao}
          </p>
        </div>
      )}
    </Card>
  );
}
