import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import type { Json } from "@/integrations/supabase/types";

let sessionId: string | null = null;
function getSessionId() {
  if (!sessionId) sessionId = crypto.randomUUID();
  return sessionId;
}

export function useAnalyticsEvents() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const queue = useRef<Array<{ event_name: string; event_category: string; metadata: Record<string, unknown> }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (!user?.id || !activeCompany || queue.current.length === 0) return;
    const batch = [...queue.current];
    queue.current = [];

    const rows = batch.map((e) => ({
      user_id: user.id,
      empresa: activeCompany,
      event_name: e.event_name,
      event_category: e.event_category,
      metadata: e.metadata as unknown as Json,
      session_id: getSessionId(),
    }));

    await supabase.from("analytics_events").insert(rows);
  }, [user?.id, activeCompany]);

  const track = useCallback(
    (event_name: string, event_category = "interaction", metadata: Record<string, unknown> = {}) => {
      queue.current.push({ event_name, event_category, metadata });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 3000);
    },
    [flush]
  );

  const trackPageView = useCallback(
    (page: string) => track(`page_view:${page}`, "navigation", { page }),
    [track]
  );

  const trackFeatureUse = useCallback(
    (feature: string, details?: Record<string, unknown>) => track(`feature:${feature}`, "feature", details || {}),
    [track]
  );

  return { track, trackPageView, trackFeatureUse, flush };
}
