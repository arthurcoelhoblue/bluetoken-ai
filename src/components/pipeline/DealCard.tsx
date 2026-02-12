import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DollarSign, Clock } from 'lucide-react';
import type { DealWithRelations } from '@/types/deal';

const tempColors: Record<string, string> = {
  QUENTE: 'bg-destructive/15 text-destructive border-destructive/30',
  MORNO: 'bg-warning/15 text-warning border-warning/30',
  FRIO: 'bg-muted text-muted-foreground border-border',
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
}

export function DealCard({ deal, overlay }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: 'deal', deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const days = daysInStage(deal.updated_at);

  return (
    <Card
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      className="p-3 cursor-grab active:cursor-grabbing space-y-2 hover:shadow-md transition-shadow border-border/60"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm leading-tight line-clamp-2">{deal.titulo}</span>
        <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 ${tempColors[deal.temperatura] ?? ''}`}>
          {deal.temperatura}
        </Badge>
      </div>

      {deal.contacts && (
        <p className="text-xs text-muted-foreground truncate">{deal.contacts.nome}</p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <DollarSign className="h-3 w-3" />
          {formatBRL(deal.valor ?? 0)}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {days}d
        </span>
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
    </Card>
  );
}
