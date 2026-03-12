import { useEffect, useRef, useCallback } from 'react';

const AXIS_THRESHOLD = 8;

export function useGrabScroll(scrollRef: React.RefObject<HTMLElement | null>, options: { disabled?: boolean } = {}) {
  const isDown = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeftStart = useRef(0);
  const scrollTopStart = useRef(0);
  const axisLock = useRef<'pending' | 'horizontal' | 'released'>('pending');
  const origTarget = useRef<HTMLElement | null>(null);
  const origPointerId = useRef<number | null>(null);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (options.disabled) return;
    const el = scrollRef.current;
    if (!el) return;

    const target = e.target as HTMLElement;
    // Skip interactive elements and dnd-kit draggable cards
    if (target.closest('button, a, input, textarea, select, [role="button"], [data-deal-card]')) return;

    // Only activate grab scroll in empty areas (headers, gaps, column backgrounds)
    e.stopPropagation();

    isDown.current = true;
    axisLock.current = 'pending';
    origTarget.current = target;
    origPointerId.current = e.pointerId;
    startX.current = e.pageX;
    startY.current = e.pageY;
    scrollLeftStart.current = el.scrollLeft;
    scrollTopStart.current = el.scrollTop;
  }, [scrollRef]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDown.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const dx = e.pageX - startX.current;
    const dy = e.pageY - startY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (axisLock.current === 'pending') {
      if (absDx < AXIS_THRESHOLD && absDy < AXIS_THRESHOLD) return;
      if (absDx > absDy) {
        // Horizontal → grab scroll
        axisLock.current = 'horizontal';
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
      } else {
        // Vertical → not a scroll gesture, release
        axisLock.current = 'released';
        isDown.current = false;
        return;
      }
    }

    if (axisLock.current === 'released') return;

    // Horizontal grab scroll — block everything else
    e.preventDefault();
    e.stopImmediatePropagation();
    el.scrollLeft = scrollLeftStart.current - dx;
  }, [scrollRef]);

  const onPointerUp = useCallback(() => {
    if (!isDown.current && axisLock.current !== 'horizontal') return;
    isDown.current = false;
    const el = scrollRef.current;
    if (el) {
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    }
    axisLock.current = 'pending';
    origTarget.current = null;
    origPointerId.current = null;
  }, [scrollRef]);

  // --- Touch fallback ---
  const onTouchStart = useCallback((e: TouchEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;

    const touch = e.touches[0];
    isDown.current = true;
    axisLock.current = 'pending';
    startX.current = touch.pageX;
    startY.current = touch.pageY;
    scrollLeftStart.current = el.scrollLeft;
    scrollTopStart.current = el.scrollTop;
  }, [scrollRef]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!isDown.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const touch = e.touches[0];
    const dx = touch.pageX - startX.current;
    const dy = touch.pageY - startY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (axisLock.current === 'pending') {
      if (absDx < AXIS_THRESHOLD && absDy < AXIS_THRESHOLD) return;
      if (absDx > absDy) {
        axisLock.current = 'horizontal';
      } else {
        axisLock.current = 'released';
        return;
      }
    }

    if (axisLock.current === 'released') return;

    e.preventDefault();
    el.scrollLeft = scrollLeftStart.current - dx;
  }, [scrollRef]);

  const onTouchEnd = useCallback(() => {
    isDown.current = false;
    axisLock.current = 'pending';
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.style.cursor = 'grab';

    // Pointer events in capture phase — intercepts before dnd-kit
    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true });

    // Touch fallback
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [scrollRef, onPointerDown, onPointerMove, onPointerUp, onTouchStart, onTouchMove, onTouchEnd]);
}
