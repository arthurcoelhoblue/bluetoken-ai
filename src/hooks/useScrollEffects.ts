import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Returns a 0→1 progress value based on how far the element has scrolled
 * through the viewport. `start` and `end` control the trigger zone.
 */
export function useScrollProgress(options?: { start?: number; end?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const start = options?.start ?? 0;
  const end = options?.end ?? 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf: number;
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const elTop = rect.top;
        const elHeight = rect.height;
        const vh = window.innerHeight;

        // raw = 0 when top of element hits bottom of viewport
        // raw = 1 when bottom of element hits top of viewport
        const raw = (vh - elTop) / (vh + elHeight);
        const mapped = (raw - start) / (end - start);
        setProgress(Math.max(0, Math.min(1, mapped)));
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [start, end]);

  return { ref, progress };
}

/**
 * Tracks scroll progress within a tall container for sticky pinned sections.
 * Returns 0→1 based on how far the user has scrolled within the container.
 */
export function useStickyProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf: number;
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const scrollable = el.scrollHeight - window.innerHeight;
        if (scrollable <= 0) { setProgress(0); return; }
        const raw = -rect.top / scrollable;
        setProgress(Math.max(0, Math.min(1, raw)));
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, progress };
}

/**
 * Counter animation — counts from 0 to target when in viewport.
 */
export function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) setStarted(true);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - pct, 3);
      setValue(Math.round(target * eased));
      if (pct < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [started, target, duration]);

  return { ref, value };
}

/**
 * Parallax offset based on scroll position.
 */
export function useParallax(speed = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let raf: number;
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        setOffset(center * speed);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return { ref, offset };
}
