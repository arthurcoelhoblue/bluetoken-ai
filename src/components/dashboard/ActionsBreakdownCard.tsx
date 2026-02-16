import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, ChevronRight } from 'lucide-react';
import { ACAO_LABELS, getAcaoColor, getAcaoIcon, type SdrAcaoTipo } from '@/types/intent';
import { useNavigate } from 'react-router-dom';

interface ActionsBreakdownCardProps {
  data: { acao: string; count: number; aplicada: number }[] | undefined;
  isLoading: boolean;
}

// Mapeia ação para rota de correção
const getActionRoute = (acao: string): string => {
  switch (acao) {
    case 'CRIAR_TAREFA_CLOSER':
    case 'ESCALAR_HUMANO':
      return `/leads?acao_pendente=${acao}`;
    case 'PAUSAR_CADENCIA':
    case 'CANCELAR_CADENCIA':
    case 'RETOMAR_CADENCIA':
      return `/cadences/runs?acao_pendente=${acao}`;
    case 'AJUSTAR_TEMPERATURA':
    case 'MARCAR_OPT_OUT':
      return `/leads?acao_pendente=${acao}`;
    case 'ENVIAR_RESPOSTA_AUTOMATICA':
      return `/leads?acao_pendente=${acao}`;
    default:
      return `/leads?acao_pendente=${acao}`;
  }
};

export function ActionsBreakdownCard({ data, isLoading }: ActionsBreakdownCardProps) {
  const navigate = useNavigate();

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
            const icon = getAcaoIcon(action.acao as SdrAcaoTipo);
            const colorClass = getAcaoColor(action.acao as SdrAcaoTipo);
            const taxaAplicacao = action.count > 0 
              ? Math.round((action.aplicada / action.count) * 100) 
              : 0;
            const pendentes = action.count - action.aplicada;

            return (
              <div
                key={action.acao}
                onClick={() => pendentes > 0 && navigate(getActionRoute(action.acao))}
                className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 transition-colors ${
                  pendentes > 0 
                    ? 'cursor-pointer hover:bg-muted' 
                    : 'opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.aplicada} de {action.count} aplicadas
                      {pendentes > 0 && (
                        <span className="text-primary ml-1">
                          ({pendentes} pendente{pendentes > 1 ? 's' : ''})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={colorClass}>
                    {taxaAplicacao}%
                  </Badge>
                  <span className="text-lg font-bold">{action.count}</span>
                  {pendentes > 0 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
