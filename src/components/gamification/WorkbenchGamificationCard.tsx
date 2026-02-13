import { Card, CardContent } from '@/components/ui/card';
import { Flame, Trophy, Award } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useGamification';
import { useAuth } from '@/contexts/AuthContext';

export function WorkbenchGamificationCard() {
  const { user } = useAuth();
  const { data: leaderboard } = useLeaderboard();

  const myEntry = leaderboard?.find(e => e.user_id === user?.id);

  if (!myEntry) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {myEntry.ranking_posicao}º no ranking
            </p>
            <p className="text-xs text-muted-foreground">
              {myEntry.pontos_mes} pontos este mês
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          {myEntry.streak_dias > 0 && (
            <div className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold">{myEntry.streak_dias}d</span>
            </div>
          )}
          {myEntry.total_badges > 0 && (
            <div className="flex items-center gap-1">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{myEntry.total_badges}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
