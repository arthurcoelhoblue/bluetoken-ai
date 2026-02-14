import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const TIPO_LABELS: Record<string, string> = {
  DEAL_GANHO: '🎯 Deal ganho',
  TAREFA_CONCLUIDA: '✅ Tarefa concluída',
};

const BADGE_LABELS: Record<string, { icon: string; nome: string }> = {
  first_deal: { icon: '🏆', nome: 'Primeiro Deal' },
  deal_10: { icon: '🔥', nome: '10 Deals' },
  deal_50: { icon: '💎', nome: '50 Deals' },
  streak_3: { icon: '⚡', nome: 'Streak 3 dias' },
  streak_7: { icon: '🌟', nome: 'Streak 7 dias' },
  streak_30: { icon: '👑', nome: 'Streak 30 dias' },
  activity_50: { icon: '🚀', nome: '50 atividades na semana' },
  meta_100: { icon: '🎯', nome: 'Meta 100%' },
  meta_150: { icon: '💫', nome: 'Meta 150%' },
  top_month: { icon: '🥇', nome: '#1 do mês' },
};

export function useGamificationNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('gamification-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'seller_points_log',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { pontos: number; tipo: string };
          const label = TIPO_LABELS[row.tipo] || row.tipo;
          toast.success(`${label} — +${row.pontos} pts`, {
            duration: 4000,
          });
          queryClient.invalidateQueries({ queryKey: ['seller_leaderboard'] });
          queryClient.invalidateQueries({ queryKey: ['recent_awards'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'seller_badge_awards',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { badge_key: string };
          const badge = BADGE_LABELS[row.badge_key] || { icon: '🏅', nome: row.badge_key };
          toast.success(`${badge.icon} Badge desbloqueado: ${badge.nome}!`, {
            duration: 6000,
          });
          queryClient.invalidateQueries({ queryKey: ['my_badges'] });
          queryClient.invalidateQueries({ queryKey: ['seller_leaderboard'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
