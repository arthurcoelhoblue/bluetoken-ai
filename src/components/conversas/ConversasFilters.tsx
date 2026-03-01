import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  AlertTriangle,
  Flame,
  Target,
  Sparkles,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SmartFilter =
  | 'TODOS'
  | 'AGUARDANDO'
  | 'SLA_ESTOURADO'
  | 'ESFRIANDO'
  | 'INTENCAO_COMPRA'
  | 'NAO_LIDAS';

interface FilterDef {
  key: SmartFilter;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface ConversasFiltersProps {
  activeFilter: SmartFilter;
  onFilterChange: (filter: SmartFilter) => void;
  aiSortActive: boolean;
  onToggleAiSort: () => void;
  counts: {
    total: number;
    aguardando: number;
    slaEstourado: number;
    esfriando: number;
    intencaoCompra: number;
    naoLidas: number;
  };
}

export function ConversasFilters({
  activeFilter,
  onFilterChange,
  aiSortActive,
  onToggleAiSort,
  counts,
}: ConversasFiltersProps) {
  const filters: FilterDef[] = [
    { key: 'TODOS', label: 'Todos', icon: <Inbox className="h-3.5 w-3.5" />, count: counts.total },
    { key: 'AGUARDANDO', label: 'Aguardando', icon: <MessageCircle className="h-3.5 w-3.5" />, count: counts.aguardando },
    { key: 'SLA_ESTOURADO', label: 'SLA estourado', icon: <AlertTriangle className="h-3.5 w-3.5" />, count: counts.slaEstourado },
    { key: 'ESFRIANDO', label: 'Esfriando', icon: <Flame className="h-3.5 w-3.5" />, count: counts.esfriando },
    { key: 'INTENCAO_COMPRA', label: 'Intenção', icon: <Target className="h-3.5 w-3.5" />, count: counts.intencaoCompra },
    { key: 'NAO_LIDAS', label: 'Não lidas', icon: <MessageCircle className="h-3.5 w-3.5" />, count: counts.naoLidas },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onFilterChange(f.key)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
            activeFilter === f.key
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {f.icon}
          {f.label}
          {f.count !== undefined && f.count > 0 && (
            <Badge
              variant={activeFilter === f.key ? 'secondary' : 'outline'}
              className="text-[10px] py-0 px-1.5 ml-0.5 h-4"
            >
              {f.count}
            </Badge>
          )}
        </button>
      ))}

      <div className="ml-auto">
        <Button
          variant={aiSortActive ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleAiSort}
          className="gap-1.5 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Prioridade IA
        </Button>
      </div>
    </div>
  );
}
