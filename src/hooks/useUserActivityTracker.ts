import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

const DEBOUNCE_MS = 30_000; // 1 registro por rota a cada 30s

export function useUserActivityTracker() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const location = useLocation();
  const lastRouteRef = useRef<string>('');
  const lastTrackTimeRef = useRef<Record<string, number>>({});

  const trackAction = useCallback(
    async (actionType: string, actionDetail: Record<string, unknown> = {}) => {
      if (!user?.id || !activeCompany) return;

      const key = `${actionType}:${JSON.stringify(actionDetail)}`;
      const now = Date.now();
      if (now - (lastTrackTimeRef.current[key] || 0) < DEBOUNCE_MS) return;
      lastTrackTimeRef.current[key] = now;

      try {
        await (supabase.from('user_activity_log') as any).insert({
          user_id: user.id,
          empresa: activeCompany,
          action_type: actionType,
          action_detail: actionDetail,
        });
      } catch {
        // silently fail — activity tracking is non-critical
      }
    },
    [user?.id, activeCompany],
  );

  // Auto-track PAGE_VIEW on route change
  useEffect(() => {
    const path = location.pathname;
    if (path === lastRouteRef.current) return;
    lastRouteRef.current = path;
    trackAction('PAGE_VIEW', { route: path });
  }, [location.pathname, trackAction]);

  return { trackAction };
}
