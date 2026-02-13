import { useEffect, useRef, useCallback } from 'react';

export function useGrabScroll(scrollRef: React.RefObject<HTMLElement | null>) {
  const isDown = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeftStart = useRef(0);
  const scrollTopStart = useRef(0);

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;

    // Don't grab if clicking on a deal card or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('[data-draggable], button, a, input, textarea, select, [role="button"]')) return;

    isDown.current = true;
    startX.current = e.pageX;
    startY.current = e.pageY;
    scrollLeftStart.current = el.scrollLeft;
    scrollTopStart.current = el.scrollTop;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, [scrollRef]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDown.current) return;
    const el = scrollRef.current;
    if (!el) return;

    e.preventDefault();
    const dx = e.pageX - startX.current;
    const dy = e.pageY - startY.current;
    el.scrollLeft = scrollLeftStart.current - dx;
    el.scrollTop = scrollTopStart.current - dy;
  }, [scrollRef]);

  const onMouseUp = useCallback(() => {
    if (!isDown.current) return;
    isDown.current = false;
    const el = scrollRef.current;
    if (el) {
      el.style.cursor = 'grab';
      el.style.removeProperty('user-select');
    }
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.style.cursor = 'grab';
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [scrollRef, onMouseDown, onMouseMove, onMouseUp]);
}
