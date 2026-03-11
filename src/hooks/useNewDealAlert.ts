import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Silent fail if audio not available
  }
}

export function useNewDealAlert() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const channel = supabase
      .channel('new-deal-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deals' },
        async (payload) => {
          const { pipeline_id, stage_id, id, titulo } = payload.new as {
            pipeline_id: string;
            stage_id: string;
            id: string;
            titulo: string;
          };

          // Fetch pipeline + stage info
          const [pipelineRes, stageRes] = await Promise.all([
            supabase.from('pipelines').select('nome, empresa').eq('id', pipeline_id).single(),
            supabase.from('pipeline_stages').select('nome').eq('id', stage_id).single(),
          ]);

          const empresa = pipelineRes.data?.empresa ?? '';
          const pipelineNome = pipelineRes.data?.nome ?? 'Pipeline';
          const stageNome = stageRes.data?.nome ?? 'Etapa';

          playNotificationSound();

          toast(`🔔 Novo Lead — ${empresa}`, {
            description: `${pipelineNome} → ${stageNome}\n${titulo}`,
            duration: 4000,
            action: {
              label: 'Ver',
              onClick: () => {
                navigateRef.current(`/pipeline?deal=${id}`);
              },
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
