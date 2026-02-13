import { useState, useCallback } from 'react';
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
import type { KanbanColumn as KanbanColumnType, DealWithRelations } from '@/types/deal';

interface KanbanBoardProps {
  columns: KanbanColumnType[];
  wonLost: KanbanColumnType[];
  isLoading: boolean;
  onDealClick?: (dealId: string) => void;
}

export function KanbanBoard({ columns, wonLost, isLoading, onDealClick }: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);
  const moveDeal = useMoveDeal();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = event.active.data.current?.deal as DealWithRelations | undefined;
    if (deal) setActiveDeal(deal);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDeal(null);
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
    [columns, wonLost, moveDeal]
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
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
        {columns.map(col => (
          <KanbanColumn key={col.stage.id} column={col} onDealClick={onDealClick} />
        ))}
      </div>

      {wonLost.some(c => c.deals.length > 0) && (
        <>
          <div className="mt-6 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Encerrados
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {wonLost.map(col => (
              <KanbanColumn key={col.stage.id} column={col} onDealClick={onDealClick} />
            ))}
          </div>
        </>
      )}

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
