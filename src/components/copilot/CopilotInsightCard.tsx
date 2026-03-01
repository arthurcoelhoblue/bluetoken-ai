import { AlertTriangle, TrendingUp, Clock, Target, Sparkles, X, ExternalLink } from 'lucide-react';
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

const CATEGORY_ROUTE: Record<string, string> = {
  FOLLOW_UP: '/conversas',
  DEAL_PARADO: '/pipeline',
  SLA_RISCO: '/pipeline',
  META_RISCO: '/meu-dia',
};

const CATEGORY_ACTION_LABEL: Record<string, string> = {
  FOLLOW_UP: 'Ir para conversas →',
  DEAL_PARADO: 'Ver pipeline →',
  SLA_RISCO: 'Ver pipeline →',
  META_RISCO: 'Ver metas →',
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

  const handleDealClick = () => {
    if (insight.deal_id) {
      navigate(`/pipeline?deal=${insight.deal_id}`);
    }
  };

  const handleCategoryAction = () => {
    const route = CATEGORY_ROUTE[insight.categoria];
    if (route) navigate(route);
  };

  // Determine if there's a primary action available
  const hasLeadAction = !!(insight.lead_id && leadNome && empresa);
  const hasDealAction = !!insight.deal_id;
  const hasCategoryAction = !!(CATEGORY_ROUTE[insight.categoria] && !hasLeadAction && !hasDealAction);
  const isActionable = hasLeadAction || hasDealAction || hasCategoryAction;

  const handleCardClick = () => {
    if (hasLeadAction) return handleLeadClick();
    if (hasDealAction) return handleDealClick();
    if (hasCategoryAction) return handleCategoryAction();
  };

  // Render titulo with lead name as a clickable link
  const renderTitulo = () => {
    if (!leadNome || !insight.lead_id || !empresa) {
      return <span className="font-medium break-words">{titulo}</span>;
    }
    const idx = titulo.indexOf(leadNome);
    if (idx === -1) {
      return <span className="font-medium break-words">{titulo}</span>;
    }
    const before = titulo.substring(0, idx);
    const after = titulo.substring(idx + leadNome.length);
    return (
      <span className="font-medium break-words">
        {before}
        <button
          onClick={(e) => { e.stopPropagation(); handleLeadClick(); }}
          className="text-primary hover:underline font-medium"
        >
          {leadNome}
        </button>
        {after}
      </span>
    );
  };

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg border bg-accent/30 text-sm transition-colors ${isActionable ? 'cursor-pointer hover:bg-accent/50' : ''}`}
      onClick={isActionable ? handleCardClick : undefined}
    >
      <div className="mt-0.5 shrink-0">
        {ICON_MAP[insight.categoria] || <Sparkles className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {renderTitulo()}
          <Badge variant={PRIORITY_VARIANT[insight.prioridade] || 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
            {insight.prioridade}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-wrap">
          {descricao}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {hasLeadAction && (
            <button
              onClick={(e) => { e.stopPropagation(); handleLeadClick(); }}
              className="text-xs text-primary hover:underline font-medium mt-1 flex items-center gap-1"
            >
              Ver perfil de {leadNome} <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {hasDealAction && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDealClick(); }}
              className="text-xs text-primary hover:underline font-medium mt-1 flex items-center gap-1"
            >
              Ver negócio <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {hasCategoryAction && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCategoryAction(); }}
              className="text-xs text-primary hover:underline font-medium mt-1 flex items-center gap-1"
            >
              {CATEGORY_ACTION_LABEL[insight.categoria]} <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={(e) => { e.stopPropagation(); onDismiss(insight.id); }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
