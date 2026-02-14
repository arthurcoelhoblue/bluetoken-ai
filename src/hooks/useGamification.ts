import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import type { LeaderboardEntry, Badge, BadgeAward, PointsLog } from '@/types/gamification';

function empresaFilter(activeCompany: string) {
  if (activeCompany === 'ALL') return null;
  return activeCompany as 'BLUE' | 'TOKENIZA';
}

export function useLeaderboard() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['seller_leaderboard', activeCompany],
    queryFn: async () => {
      let q = supabase.from('seller_leaderboard').select('*');
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      q = q.order('ranking_posicao', { ascending: true }).limit(20);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LeaderboardEntry[];
    },
  });
}

export function useAllBadges() {
  return useQuery({
    queryKey: ['seller_badges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_badges')
        .select('*')
        .order('categoria', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Badge[];
    },
  });
}

export function useMyBadges() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['my_badges', user?.id, activeCompany],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from('seller_badge_awards').select('*').eq('user_id', user!.id);
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BadgeAward[];
    },
  });
}

export function useRecentAwards() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['recent_awards', activeCompany],
    queryFn: async () => {
      let q = supabase
        .from('seller_points_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      const emp = empresaFilter(activeCompany);
      if (emp) q = q.eq('empresa', emp);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PointsLog[];
    },
  });
}
