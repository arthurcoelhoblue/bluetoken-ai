import { AlertTriangle, TrendingUp, Clock, Target, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
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
  leadNome?: string | null;
  empresa?: string | null;
}

export function CopilotInsightCard({ insight, onDismiss, leadNome, empresa }: Props) {
  const navigate = useNavigate();

  // Replace lead ID references in titulo/descricao with the actual name
  const resolveLeadName = (text: string): string => {
    if (!insight.lead_id || !leadNome) return text;
    const shortId = insight.lead_id.substring(0, 8);
    // Replace patterns like "Lead 63b6bce7" or just the UUID fragment
    return text
      .replace(new RegExp(`Lead\\s+${shortId}[\\w-]*`, 'gi'), leadNome)
      .replace(new RegExp(shortId, 'g'), leadNome);
  };

  const titulo = resolveLeadName(insight.titulo);
  const descricao = resolveLeadName(insight.descricao);

  const handleLeadClick = () => {
    if (insight.lead_id && empresa) {
      navigate(`/leads/${insight.lead_id}/${empresa}`);
    }
  };

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border bg-accent/30 text-sm">
      <div className="mt-0.5 shrink-0">
        {ICON_MAP[insight.categoria] || <Sparkles className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium break-words">{titulo}</span>
          <Badge variant={PRIORITY_VARIANT[insight.prioridade] || 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
            {insight.prioridade}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-wrap">
          {descricao}
        </p>
        {insight.lead_id && leadNome && empresa && (
          <button
            onClick={handleLeadClick}
            className="text-xs text-primary hover:underline font-medium mt-1"
          >
            Ver perfil de {leadNome} →
          </button>
        )}
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
