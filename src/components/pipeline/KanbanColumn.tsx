import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DealCard } from './DealCard';
import type { KanbanColumn as KanbanColumnType } from '@/types/deal';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface KanbanColumnProps {
  column: KanbanColumnType;
}

export function KanbanColumn({ column }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  const dealIds = column.deals.map(d => d.id);

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg" style={{ borderTop: `3px solid ${column.stage.cor}` }}>
        <span className="font-semibold text-sm truncate">{column.stage.nome}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {column.deals.length}
        </span>
      </div>
      <div className="px-3 pb-2 text-xs text-muted-foreground">
        {formatBRL(column.totalValor)}
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 px-2 py-2 rounded-b-lg min-h-[120px] transition-colors ${
          isOver ? 'bg-accent/40 ring-2 ring-primary/30' : 'bg-muted/30'
        }`}
      >
        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {column.deals.map(deal => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>

        {column.deals.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/60 italic">
            Arraste deals aqui
          </div>
        )}
      </div>
    </div>
  );
}
