import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Trophy, Award, Zap, Flame, CalendarCheck, ShieldCheck,
  Crown, Target, Rocket, Activity,
} from 'lucide-react';
import { useAllBadges, useMyBadges } from '@/hooks/useGamification';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy, award: Award, zap: Zap, flame: Flame,
  'calendar-check': CalendarCheck, 'shield-check': ShieldCheck,
  crown: Crown, target: Target, rocket: Rocket, activity: Activity,
};

export function BadgeShowcase() {
  const { data: allBadges, isLoading: loadingBadges } = useAllBadges();
  const { data: myAwards, isLoading: loadingAwards } = useMyBadges();

  const isLoading = loadingBadges || loadingAwards;
  const earnedKeys = new Set(myAwards?.map(a => a.badge_key) ?? []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          Conquistas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : !allBadges?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum badge configurado</p>
        ) : (
          <TooltipProvider>
            <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-10 gap-3">
              {allBadges.map(badge => {
                const earned = earnedKeys.has(badge.key);
                const Icon = iconMap[badge.icone] ?? Trophy;
                return (
                  <Tooltip key={badge.key}>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                          earned
                            ? 'bg-primary/10 border-primary/30 shadow-sm'
                            : 'bg-muted/50 border-border opacity-40 grayscale'
                        }`}
                      >
                        <Icon className={`h-6 w-6 ${earned ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                          {badge.nome}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{badge.nome}</p>
                      <p className="text-xs text-muted-foreground">{badge.descricao}</p>
                      {!earned && <p className="text-xs text-muted-foreground mt-1">🔒 Ainda não conquistado</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
