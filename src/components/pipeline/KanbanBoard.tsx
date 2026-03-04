import { useState, useCallback, useRef, useMemo, useEffect, useDeferredValue } from 'react';
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
import { Sparkles, GripVertical, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { KanbanColumn as KanbanColumnType, DealWithRelations } from '@/types/deal';

interface KanbanBoardProps {
  columns: KanbanColumnType[];
  wonLost: KanbanColumnType[];
  isLoading: boolean;
  onDealClick?: (dealId: string) => void;
  onTransferClick?: () => void;
}

function calcUrgencyScore(deal: DealWithRelations, slaMinutos: number | null): number {
  const prob = deal.score_probabilidade || 50;
  const days = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
  const daysNorm = Math.min(days / 30, 1) * 100;
  const slaPct = slaMinutos ? Math.min((days * 24 * 60) / slaMinutos, 1.5) * 100 : 0;
  const valorNorm = Math.min((deal.valor ?? 0) / 100000, 1) * 100;

  return (100 - prob) * 0.4 + daysNorm * 0.3 + slaPct * 0.2 + valorNorm * 0.1;
}

export function KanbanBoard({ columns, wonLost, isLoading, onDealClick, onTransferClick }: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moveDeal = useMoveDeal();
  useGrabScroll(scrollRef);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 0]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);

    // Calculate which columns are visible (w-64 = 256px + gap-4 = 16px)
    const colWidth = 256 + 16;
    const padding = 24; // px-6
    const scrollPos = el.scrollLeft;
    const viewWidth = el.clientWidth;
    const firstVisible = Math.floor((scrollPos) / colWidth);
    const lastVisible = Math.min(
      Math.floor((scrollPos + viewWidth - padding) / colWidth),
      columns.length - 1
    );
    setVisibleRange([Math.max(0, firstVisible), Math.max(0, lastVisible)]);
  }, [columns.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, isLoading]);

  const scrollBy = useCallback((dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  }, []);

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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (iaSort) return;
    const deal = event.active.data.current?.deal as DealWithRelations | undefined;
    if (deal) setActiveDeal(deal);
  }, [iaSort]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDeal(null);
      if (iaSort) return;
      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const overId = over.id as string;

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
        {onTransferClick && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onTransferClick}>
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Transferir em massa
          </Button>
        )}
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

      {/* Carousel wrapper */}
      <div className="relative flex-1 min-h-0">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scrollBy(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-background/90 border border-border shadow-md hover:bg-accent transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}
        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scrollBy(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-background/90 border border-border shadow-md hover:bg-accent transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* Gradient indicators */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-[5] pointer-events-none" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-[5] pointer-events-none" />
        )}

        {/* Column progress dots */}
        {sortedColumns.length > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1 border border-border/50 shadow-sm">
            {sortedColumns.map((col, i) => {
              const isVisible = i >= visibleRange[0] && i <= visibleRange[1];
              return (
                <button
                  key={col.stage.id}
                  onClick={() => {
                    const el = scrollRef.current;
                    if (!el) return;
                    const colWidth = 256 + 16;
                    el.scrollTo({ left: i * colWidth, behavior: 'smooth' });
                  }}
                  className={`rounded-full transition-all duration-200 ${
                    isVisible
                      ? 'w-4 h-1.5 bg-primary'
                      : 'w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  aria-label={col.stage.nome}
                  title={col.stage.nome}
                />
              );
            })}
          </div>
        )}

        <div ref={scrollRef} className="overflow-auto h-full pb-6" data-grab-area>
          <div className="flex gap-4 pb-4 min-h-[400px] px-6" style={{ minWidth: 'max-content' }}>
            {sortedColumns.map(col => (
              <KanbanColumn key={col.stage.id} column={col} onDealClick={onDealClick} />
            ))}
          </div>

          {wonLost.some(c => c.deals.length > 0) && (
            <>
              <div className="mt-6 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6">
                Encerrados
              </div>
              <div className="flex gap-4 pb-4 px-6" style={{ minWidth: 'max-content' }}>
                {wonLost.map(col => (
                  <KanbanColumn key={col.stage.id} column={col} onDealClick={onDealClick} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
