import { AlertTriangle, TrendingUp, Clock, Target, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CopilotInsight } from '@/hooks/useCopilotInsights';

const ICON_MAP: Record<string, React.ReactNode> = {
  DEAL_PARADO: <Clock className="h-4 w-4 text-orange-500" />,
  SLA_RISCO: <AlertTriangle className="h-4 w-4 text-destructive" />,
  FOLLOW_UP: <Clock className="h-4 w-4 text-blue-500" />,
  META_RISCO: <Target className="h-4 w-4 text-destructive" />,
  PADRAO_POSITIVO: <TrendingUp className="h-4 w-4 text-green-500" />,
  COACHING: <Sparkles className="h-4 w-4 text-primary" />,
};

const PRIORITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  ALTA: 'destructive',
  MEDIA: 'default',
  BAIXA: 'secondary',
};

interface Props {
  insight: CopilotInsight;
  onDismiss: (id: string) => void;
}

export function CopilotInsightCard({ insight, onDismiss }: Props) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border bg-accent/30 text-sm">
      <div className="mt-0.5 shrink-0">
        {ICON_MAP[insight.categoria] || <Sparkles className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{insight.titulo}</span>
          <Badge variant={PRIORITY_VARIANT[insight.prioridade] || 'secondary'} className="text-[10px] px-1.5 py-0">
            {insight.prioridade}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">{insight.descricao}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onDismiss(insight.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
