import { useEffect, useRef, useCallback } from 'react';

const AXIS_THRESHOLD = 8;

export function useGrabScroll(scrollRef: React.RefObject<HTMLElement | null>) {
  const isDown = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeftStart = useRef(0);
  const scrollTopStart = useRef(0);
  // 'pending' = waiting to determine axis, 'horizontal' = locked to scroll, 'released' = let dnd-kit handle
  const axisLock = useRef<'pending' | 'horizontal' | 'released'>('pending');

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;

    const target = e.target as HTMLElement;
    // Only exclude truly interactive elements
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;

    isDown.current = true;
    axisLock.current = 'pending';
    startX.current = e.pageX;
    startY.current = e.pageY;
    scrollLeftStart.current = el.scrollLeft;
    scrollTopStart.current = el.scrollTop;
  }, [scrollRef]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDown.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const dx = e.pageX - startX.current;
    const dy = e.pageY - startY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Determine axis on first significant movement
    if (axisLock.current === 'pending') {
      if (absDx < AXIS_THRESHOLD && absDy < AXIS_THRESHOLD) return;
      if (absDx > absDy) {
        axisLock.current = 'horizontal';
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
      } else {
        axisLock.current = 'released';
        return;
      }
    }

    if (axisLock.current === 'released') return;

    // Horizontal scroll mode - block dnd-kit
    e.preventDefault();
    e.stopPropagation();
    el.scrollLeft = scrollLeftStart.current - dx;
  }, [scrollRef]);

  const onMouseUp = useCallback(() => {
    if (!isDown.current) return;
    isDown.current = false;
    const el = scrollRef.current;
    if (el) {
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    }
    axisLock.current = 'pending';
  }, [scrollRef]);

  // --- Touch support ---
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

    // Mouse
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { capture: true });
    window.addEventListener('mouseup', onMouseUp);

    // Touch
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove, { capture: true });
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [scrollRef, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd]);
}
