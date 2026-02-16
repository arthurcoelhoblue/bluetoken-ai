import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CopilotInsight {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  deal_id: string | null;
  lead_id: string | null;
  dispensado: boolean;
  created_at: string;
}

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 min

export function useCopilotInsights(empresa: string) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<CopilotInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);

  const fetchInsights = useCallback(async () => {
    if (!user?.id || !empresa) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('copilot_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('empresa', empresa)
        .eq('dispensado', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setInsights((data as CopilotInsight[]) || []);
    } catch (_err) {
      // Error handled silently — UI shows empty state
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, empresa]);

  const generateInsights = useCallback(async (force = false) => {
    if (!user?.id || !empresa) return;
    const now = Date.now();
    if (!force && now - lastFetchRef.current < CACHE_DURATION_MS) return;
    lastFetchRef.current = now;

    try {
      const { data, error } = await supabase.functions.invoke('copilot-proactive', {
        body: { empresa },
      });

      if (error) {
        const status = (error as any)?.status ?? (error as any)?.context?.status;
        if (status === 429 || status === 402) return;
        throw error;
      }

      if (data?.insights) {
        await fetchInsights();
      }
    } catch (_err) {
      // Error handled silently — insights will be retried next cycle
    }
  }, [user?.id, empresa, fetchInsights]);

  const dismissInsight = useCallback(async (insightId: string) => {
    try {
      await supabase
        .from('copilot_insights')
        .update({ dispensado: true })
        .eq('id', insightId);

      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (_err) {
      // Error handled silently — UI already removed the card
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const pendingCount = insights.length;

  return {
    insights,
    isLoading,
    pendingCount,
    generateInsights,
    dismissInsight,
    refetch: fetchInsights,
  };
}
