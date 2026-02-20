import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCopilotInsights } from '@/hooks/useCopilotInsights';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserActivityTracker } from '@/hooks/useUserActivityTracker';
import { CopilotPanel } from './CopilotPanel';
import type { CopilotContextType } from '@/types/conversas';

const STORAGE_KEY = 'copilot-fab-position';
const DRAG_THRESHOLD = 5;
const BUBBLE_TIMEOUT = 8000;
const FAB_SIZE = 48;

function getCopilotContext(pathname: string, empresa: string): { type: CopilotContextType; id?: string; empresa: string } {
  const leadMatch = pathname.match(/^\/leads\/([^/]+)\/([^/]+)$/);
  if (leadMatch) return { type: 'LEAD', id: leadMatch[1], empresa: leadMatch[2] };

  const csMatch = pathname.match(/^\/cs\/clientes\/([^/]+)$/);
  if (csMatch) return { type: 'CUSTOMER', id: csMatch[1], empresa };

  if (pathname === '/pipeline') return { type: 'PIPELINE', empresa };

  return { type: 'GERAL', empresa };
}

function loadPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const pos = JSON.parse(raw);
      // Validate that saved position is within current viewport bounds
      if (
        typeof pos.x === 'number' &&
        typeof pos.y === 'number' &&
        pos.x >= 0 &&
        pos.y >= 0 &&
        pos.x <= window.innerWidth - FAB_SIZE &&
        pos.y <= window.innerHeight - FAB_SIZE
      ) {
        return pos;
      }
      // Invalid position – clear it so we fall back to default
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* ignore – corrupt localStorage */ }
  return null;
}

function savePosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch { /* ignore – localStorage full or unavailable */ }
}

export function CopilotFab() {
  const location = useLocation();
  const { activeCompany } = useCompany();
  const context = getCopilotContext(location.pathname, activeCompany);

  const { insights, pendingCount, generateInsights } = useCopilotInsights(context.empresa);

  // Activate user activity tracking (auto PAGE_VIEW on route change)
  useUserActivityTracker();

  // Auto-generate insights on mount + every 30 min
  useEffect(() => {
    generateInsights();
    const interval = setInterval(() => generateInsights(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [generateInsights]);

  const [open, setOpen] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const prevCountRef = useRef(pendingCount);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = loadPosition();
    const defaultPos = { x: window.innerWidth - FAB_SIZE - 24, y: window.innerHeight - FAB_SIZE - 24 };
    if (!saved) return defaultPos;
    // Extra clamp in case viewport shrank since last save
    return {
      x: Math.max(0, Math.min(saved.x, window.innerWidth - FAB_SIZE)),
      y: Math.max(0, Math.min(saved.y, window.innerHeight - FAB_SIZE)),
    };
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ px: 0, py: 0, sx: 0, sy: 0 });
  const didDragRef = useRef(false);

  // Show bubble when pendingCount increases
  useEffect(() => {
    if (pendingCount > 0 && pendingCount > prevCountRef.current && insights.length > 0) {
      const newest = insights[0];
      setBubbleText(newest.titulo);
      clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => setBubbleText(null), BUBBLE_TIMEOUT);
    }
    prevCountRef.current = pendingCount;
  }, [pendingCount, insights]);

  useEffect(() => () => clearTimeout(bubbleTimerRef.current), []);

  // Clamp position on resize
  useEffect(() => {
    const onResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - FAB_SIZE),
        y: Math.min(prev.y, window.innerHeight - FAB_SIZE),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartRef.current = { px: e.clientX, py: e.clientY, sx: position.x, sy: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.px;
    const dy = e.clientY - dragStartRef.current.py;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      didDragRef.current = true;
    }
    const newX = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, dragStartRef.current.sx + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragStartRef.current.sy + dy));
    setPosition({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false;
    if (didDragRef.current) {
      setPosition(prev => {
        savePosition(prev);
        return prev;
      });
    } else {
      setOpen(true);
    }
  }, []);

  const dismissBubble = useCallback(() => {
    setBubbleText(null);
    clearTimeout(bubbleTimerRef.current);
  }, []);

  // Determine if bubble goes left or right of the FAB
  const bubbleOnLeft = position.x > window.innerWidth / 2;

  return (
    <>
      {/* Notification bubble */}
      {bubbleText && !open && (
        <div
          className="fixed z-[60] animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{
            ...(bubbleOnLeft
              ? { right: window.innerWidth - position.x + 8, bottom: window.innerHeight - position.y - FAB_SIZE / 2 + 8 }
              : { left: position.x + FAB_SIZE + 8, bottom: window.innerHeight - position.y - FAB_SIZE / 2 + 8 }),
            maxWidth: 280,
          }}
        >
          <div className="bg-primary text-primary-foreground rounded-xl px-3 py-2 shadow-lg flex items-start gap-2 text-sm">
            <Bot className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="line-clamp-2 flex-1">{bubbleText}</span>
            <button onClick={dismissBubble} className="shrink-0 hover:opacity-70">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <div
        className="fixed z-50 touch-none select-none"
        style={{ left: position.x, top: position.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg relative cursor-grab active:cursor-grabbing"
        >
          <Bot className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Button>
      </div>

      {/* Panel controlled externally */}
      <CopilotPanel
        context={context}
        variant="icon"
        externalOpen={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
