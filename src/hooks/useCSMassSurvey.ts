import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SurveyResult {
  customerId: string;
  success: boolean;
  error?: string;
}

interface MassSurveyState {
  sending: boolean;
  progress: number;
  total: number;
  results: SurveyResult[];
  done: boolean;
}

export function useCSMassSurvey() {
  const [state, setState] = useState<MassSurveyState>({
    sending: false,
    progress: 0,
    total: 0,
    results: [],
    done: false,
  });

  const reset = useCallback(() => {
    setState({ sending: false, progress: 0, total: 0, results: [], done: false });
  }, []);

  const sendBulk = useCallback(async (customerIds: string[], tipo: 'NPS' | 'CSAT') => {
    setState({ sending: true, progress: 0, total: customerIds.length, results: [], done: false });

    const results: SurveyResult[] = [];

    for (let i = 0; i < customerIds.length; i++) {
      const customerId = customerIds[i];
      try {
        const { error } = await supabase.functions.invoke('cs-scheduled-jobs', {
          body: { action: 'nps-auto', customer_id: customerId, tipo },
        });
        results.push({ customerId, success: !error, error: error?.message });
      } catch (err) {
        results.push({ customerId, success: false, error: err instanceof Error ? err.message : 'Erro' });
      }

      setState(prev => ({ ...prev, progress: i + 1, results: [...results] }));

      // Throttle between calls
      if (i < customerIds.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setState(prev => ({ ...prev, sending: false, done: true }));
    return results;
  }, []);

  return { ...state, sendBulk, reset };
}
