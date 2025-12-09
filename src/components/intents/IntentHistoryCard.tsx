// ========================================
// PATCH 5G - Card de Histórico de Interpretações IA
// ========================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Brain, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LeadMessageIntent } from '@/types/intent';
import {
  INTENT_LABELS,
  ACAO_LABELS,
  getIntentColor,
  getAcaoColor,
  getIntentIcon,
  getAcaoIcon,
} from '@/types/intent';

interface IntentHistoryCardProps {
  intents: LeadMessageIntent[];
  isLoading?: boolean;
  maxItems?: number;
  title?: string;
}

export function IntentHistoryCard({
  intents,
  isLoading = false,
  maxItems = 5,
  title = 'Interpretações IA',
}: IntentHistoryCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Bot className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayIntents = intents.slice(0, maxItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5" />
          {title}
          {intents.length > 0 && (
            <Badge variant="outline" className="ml-auto">
              {intents.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayIntents.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            Nenhuma interpretação de IA registrada.
          </p>
        ) : (
          <div className="space-y-4">
            {displayIntents.map((intent) => (
              <div
                key={intent.id}
                className="p-3 bg-muted/50 rounded-lg space-y-2"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getIntentIcon(intent.intent)}</span>
                    <Badge className={getIntentColor(intent.intent)} variant="default">
                      {INTENT_LABELS[intent.intent]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(intent.intent_confidence * 100)}%
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(intent.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                {/* Summary */}
                {intent.intent_summary && (
                  <p className="text-sm text-foreground">
                    {intent.intent_summary}
                  </p>
                )}

                {/* Action */}
                <div className="flex items-center gap-2 pt-1">
                  <Zap className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Ação:</span>
                  <Badge
                    variant={intent.acao_aplicada ? 'default' : 'outline'}
                    className={intent.acao_aplicada ? getAcaoColor(intent.acao_recomendada) : ''}
                  >
                    <span className="mr-1">{getAcaoIcon(intent.acao_recomendada)}</span>
                    {ACAO_LABELS[intent.acao_recomendada]}
                    {intent.acao_aplicada && ' ✓'}
                  </Badge>
                </div>

                {/* Metadata */}
                {(intent.tokens_usados || intent.tempo_processamento_ms) && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    {intent.tokens_usados && (
                      <span>Tokens: {intent.tokens_usados}</span>
                    )}
                    {intent.tempo_processamento_ms && (
                      <span>Tempo: {intent.tempo_processamento_ms}ms</span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {intents.length > maxItems && (
              <p className="text-sm text-muted-foreground text-center pt-2">
                +{intents.length - maxItems} interpretações anteriores
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
