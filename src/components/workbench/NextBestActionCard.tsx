import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles, RefreshCw, CheckSquare, MessageSquare,
  AlertTriangle, Clock, Flame, HeartPulse,
} from 'lucide-react';
import { useNextBestAction, type NextBestAction } from '@/hooks/useNextBestAction';
import { useCompany } from '@/contexts/CompanyContext';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  TAREFA: <CheckSquare className="h-4 w-4" />,
  FOLLOW_UP: <MessageSquare className="h-4 w-4" />,
  SLA: <AlertTriangle className="h-4 w-4" />,
  DEAL_PARADO: <Clock className="h-4 w-4" />,
  LEAD_QUENTE: <Flame className="h-4 w-4" />,
  CS_RISCO: <HeartPulse className="h-4 w-4" />,
};

const PRIORITY_STYLES: Record<string, string> = {
  ALTA: 'bg-destructive/15 text-destructive border-destructive/30',
  MEDIA: 'bg-warning/15 text-warning border-warning/30',
  BAIXA: 'bg-muted text-muted-foreground border-border',
};

export function NextBestActionCard() {
  const { data, isLoading, isError, refresh, isFetching } = useNextBestAction();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const { trackFeatureUse } = useAnalyticsEvents();

  const acoes = data?.acoes ?? [];
  const narrativaDia = data?.narrativa_dia ?? '';

  const handleClick = (acao: NextBestAction) => {
    trackFeatureUse('nba_action_clicked', { action: acao.tipo_acao, priority: acao.prioridade });
    if (acao.deal_id) navigate(`/pipeline?deal=${acao.deal_id}`);
    else if (acao.lead_id) {
      const empresa = activeCompany;
      navigate(`/leads/${acao.lead_id}/${empresa}`);
    }
  };

  if (isError) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm">Não foi possível carregar sugestões</p>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            Próximo Passo
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={refresh}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <>
            {/* Narrativa do dia */}
            {narrativaDia && (
              <p className="text-[13px] text-muted-foreground leading-relaxed pb-2 border-b border-border/40 mb-2">
                {narrativaDia}
              </p>
            )}

            {acoes.length > 0 ? (
              acoes.slice(0, 5).map((acao, i) => (
                <button
                  key={i}
                  onClick={() => handleClick(acao)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                    {ACTION_ICONS[acao.tipo_acao] ?? <Sparkles className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{acao.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{acao.motivo}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_STYLES[acao.prioridade] ?? ''}`}>
                    {acao.prioridade}
                  </Badge>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tudo em dia! Nenhuma ação urgente 🎉
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
