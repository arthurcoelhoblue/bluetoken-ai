import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DealCard } from './DealCard';
import type { KanbanColumn as KanbanColumnType } from '@/types/deal';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface KanbanColumnProps {
  column: KanbanColumnType;
  onDealClick?: (dealId: string) => void;
}

export function KanbanColumn({ column, onDealClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  const dealIds = column.deals.map(d => d.id);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col w-64 shrink-0 h-full rounded-xl overflow-hidden border border-border/50 bg-card/30">
        {/* Header with stage color */}
        <div
          className="px-3 py-2.5 flex items-center gap-2"
          style={{ backgroundColor: column.stage.cor + '22', borderBottom: `2px solid ${column.stage.cor}` }}
        >
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: column.stage.cor }} />
          <span className="font-semibold text-sm truncate">{column.stage.nome}</span>
          <span className="ml-auto text-[11px] font-medium bg-background/60 backdrop-blur-sm rounded-full px-2 py-0.5">
            {column.deals.length}
          </span>
        </div>
        <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border/30">
          {formatBRL(column.totalValor)}
        </div>

        {/* Drop area */}
        <div
          ref={setNodeRef}
          className={`flex-1 flex flex-col gap-1.5 p-1.5 min-h-[80px] transition-colors duration-100 ${
            isOver ? 'bg-primary/10 ring-2 ring-primary/30' : ''
          }`}
        >
          <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
            {column.deals.map(deal => (
              <DealCard key={deal.id} deal={deal} currentStage={column.stage} onDealClick={onDealClick} />
            ))}
          </SortableContext>

          {column.deals.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/60 italic py-4">
              Arraste deals aqui
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
