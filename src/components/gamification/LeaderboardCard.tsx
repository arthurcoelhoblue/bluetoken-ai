import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Flame, Trophy, Medal } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useGamification';

const medalIcons = [
  { icon: Crown, color: 'text-yellow-500' },
  { icon: Medal, color: 'text-gray-400' },
  { icon: Medal, color: 'text-amber-700' },
];

export function LeaderboardCard() {
  const { data: leaderboard, isLoading } = useLeaderboard();

  const maxPontos = leaderboard?.[0]?.pontos_mes ?? 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Ranking do Mês
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : !leaderboard?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sem dados de ranking este mês</p>
        ) : (
          leaderboard.slice(0, 10).map((entry, i) => {
            const pctBar = maxPontos > 0 ? (entry.pontos_mes / maxPontos) * 100 : 0;
            const medal = medalIcons[i];

            return (
              <div key={entry.user_id} className="flex items-center gap-3">
                <div className="w-7 text-center shrink-0">
                  {medal ? (
                    <medal.icon className={`h-5 w-5 ${medal.color}`} />
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">{i + 1}º</span>
                  )}
                </div>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={entry.vendedor_avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {entry.vendedor_nome?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{entry.vendedor_nome}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.streak_dias > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-warning">
                          <Flame className="h-3 w-3" />
                          {entry.streak_dias}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {entry.pontos_mes} pts
                      </Badge>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pctBar}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
