import { Badge } from '@/components/ui/badge';
import { SmilePlus, Meh, Frown } from 'lucide-react';
import { useMessageIntent } from '@/hooks/useLeadIntents';

interface SentimentBadgeProps {
  messageId: string;
}

const SENTIMENT_CONFIG = {
  POSITIVO: {
    icon: SmilePlus,
    label: 'Positivo',
    className: 'bg-success/15 text-success border-success/30',
  },
  NEUTRO: {
    icon: Meh,
    label: 'Neutro',
    className: 'bg-muted text-muted-foreground border-border',
  },
  NEGATIVO: {
    icon: Frown,
    label: 'Negativo',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
} as const;

type SentimentKey = keyof typeof SENTIMENT_CONFIG;

function mapSentiment(intent: { intent?: string; intent_confidence?: number } | null): SentimentKey | null {
  if (!intent) return null;
  // The sdr-ia-interpret stores sentiment info in acao_detalhes.sentimento
  // or we can infer from intent type
  const intentStr = intent.intent?.toUpperCase() ?? '';
  if (['INTERESSE_COMPRA', 'INTERESSE_INFORMACAO', 'FEEDBACK_POSITIVO'].includes(intentStr)) return 'POSITIVO';
  if (['RECLAMACAO', 'OBJECAO', 'CANCELAMENTO', 'FEEDBACK_NEGATIVO'].includes(intentStr)) return 'NEGATIVO';
  return 'NEUTRO';
}

export function SentimentBadge({ messageId }: SentimentBadgeProps) {
  const { data: intent, isLoading } = useMessageIntent({ messageId });

  if (isLoading || !intent) return null;

  const sentiment = mapSentiment(intent);
  if (!sentiment) return null;

  const config = SENTIMENT_CONFIG[sentiment];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`text-[10px] py-0 px-1.5 gap-0.5 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
