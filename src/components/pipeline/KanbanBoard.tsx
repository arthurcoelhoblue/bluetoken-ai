import { useState, useCallback, useRef, useMemo } from 'react';
import { useGrabScroll } from '@/hooks/useGrabScroll';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { DealCard } from './DealCard';
import { useMoveDeal } from '@/hooks/useDeals';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sparkles, GripVertical } from 'lucide-react';
import type { KanbanColumn as KanbanColumnType, DealWithRelations } from '@/types/deal';

interface KanbanBoardProps {
  columns: KanbanColumnType[];
  wonLost: KanbanColumnType[];
  isLoading: boolean;
  onDealClick?: (dealId: string) => void;
}

function calcUrgencyScore(deal: DealWithRelations, slaMinutos: number | null): number {
  const prob = deal.score_probabilidade || 50;
  const days = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
  const daysNorm = Math.min(days / 30, 1) * 100;
  const slaPct = slaMinutos ? Math.min((days * 24 * 60) / slaMinutos, 1.5) * 100 : 0;
  const valorNorm = Math.min((deal.valor ?? 0) / 100000, 1) * 100;

  return (100 - prob) * 0.4 + daysNorm * 0.3 + slaPct * 0.2 + valorNorm * 0.1;
}

export function KanbanBoard({ columns, wonLost, isLoading, onDealClick }: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moveDeal = useMoveDeal();
  useGrabScroll(scrollRef);

  const [iaSort, setIaSort] = useState(() => {
    try { return localStorage.getItem('kanban_ia_sort') === 'true'; } catch { return false; }
  });

  const toggleIaSort = useCallback(() => {
    setIaSort(prev => {
      const next = !prev;
      try { localStorage.setItem('kanban_ia_sort', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const sortedColumns = useMemo(() => {
    if (!iaSort) return columns;
    return columns.map(col => ({
      ...col,
      deals: [...col.deals].sort((a, b) =>
        calcUrgencyScore(b, col.stage.sla_minutos) - calcUrgencyScore(a, col.stage.sla_minutos)
      ),
    }));
  }, [columns, iaSort]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (iaSort) return; // Disable drag in IA sort mode
    const deal = event.active.data.current?.deal as DealWithRelations | undefined;
    if (deal) setActiveDeal(deal);
  }, [iaSort]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDeal(null);
      if (iaSort) return; // Disable drag in IA sort mode
      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const overId = over.id as string;

      // Find the target stage - over could be a stage or another deal
      let toStageId = overId;
      const allDeals = columns.concat(wonLost).flatMap(c => c.deals);
      const overDeal = allDeals.find(d => d.id === overId);
      if (overDeal) {
        toStageId = overDeal.stage_id;
      }

      const currentDeal = allDeals.find(d => d.id === dealId);
      if (!currentDeal || currentDeal.stage_id === toStageId) return;

      moveDeal.mutate({ dealId, toStageId, posicao_kanban: 0 });
    },
    [columns, wonLost, moveDeal, iaSort]
  );

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* IA Sort toggle */}
      <div className="flex items-center justify-end mb-3 gap-2">
        <Button
          variant={iaSort ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 text-xs"
          onClick={toggleIaSort}
        >
          {iaSort ? <Sparkles className="h-3.5 w-3.5" /> : <GripVertical className="h-3.5 w-3.5" />}
          {iaSort ? 'Ordenação IA' : 'Ordenação Manual'}
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div className="flex gap-4 pb-4 min-h-[400px]" style={{ minWidth: 'max-content' }}>
          {sortedColumns.map(col => (
            <KanbanColumn key={col.stage.id} column={col} onDealClick={onDealClick} />
          ))}
        </div>

        {wonLost.some(c => c.deals.length > 0) && (
          <>
            <div className="mt-6 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Encerrados
            </div>
            <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
              {wonLost.map(col => (
                <KanbanColumn key={col.stage.id} column={col} onDealClick={onDealClick} />
              ))}
            </div>
          </>
        )}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
