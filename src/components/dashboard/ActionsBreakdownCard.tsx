import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { ACAO_LABELS, getAcaoColor, getAcaoIcon } from '@/types/intent';

interface ActionsBreakdownCardProps {
  data: { acao: string; count: number; aplicada: number }[] | undefined;
  isLoading: boolean;
}

export function ActionsBreakdownCard({ data, isLoading }: ActionsBreakdownCardProps) {
  if (isLoading) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Ações Recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const actions = (data || []).filter(a => a.acao !== 'NENHUMA');

  if (actions.length === 0) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Ações Recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Sem ações recomendadas ainda
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Ações Recomendadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action) => {
            const label = ACAO_LABELS[action.acao as keyof typeof ACAO_LABELS] || action.acao;
            const icon = getAcaoIcon(action.acao as any);
            const colorClass = getAcaoColor(action.acao as any);
            const taxaAplicacao = action.count > 0 
              ? Math.round((action.aplicada / action.count) * 100) 
              : 0;

            return (
              <div
                key={action.acao}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.aplicada} de {action.count} aplicadas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={colorClass}>
                    {taxaAplicacao}%
                  </Badge>
                  <span className="text-lg font-bold">{action.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
