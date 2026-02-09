import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, CheckCircle2, Circle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConversationState } from '@/types/conversation';
import {
  ESTADO_FUNIL_LABELS,
  ESTADO_FUNIL_COLORS,
  FRAMEWORK_LABELS,
  DISC_LABELS,
  getFrameworkCompleteness,
} from '@/types/conversation';

interface ConversationStateCardProps {
  state: ConversationState | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

// Labels para campos dos frameworks
const GPCT_FIELD_LABELS = {
  g: 'Goals (Objetivos)',
  p: 'Plans (Planos)',
  c: 'Challenges (Desafios)',
  t: 'Timeline (Prazo)',
};

const BANT_FIELD_LABELS = {
  b: 'Budget (Orçamento)',
  a: 'Authority (Decisor)',
  n: 'Need (Necessidade)',
  t: 'Timeline (Prazo)',
};

const SPIN_FIELD_LABELS = {
  s: 'Situation (Situação)',
  p: 'Problem (Problema)',
  i: 'Implication (Implicação)',
  n: 'Need-payoff (Benefício)',
};

export function ConversationStateCard({ state, isLoading, error, onRetry }: ConversationStateCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Estado da Conversa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Estado da Conversa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Erro ao carregar estado da conversa.</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Tentar novamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Estado da Conversa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma conversa iniciada com este lead ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  const completeness = getFrameworkCompleteness(state.framework_ativo, state.framework_data);
  const isLowCompleteness = completeness.percentage < 25 && state.framework_ativo !== 'NONE';
  
  // Selecionar labels corretas baseado no framework
  const getFieldLabels = () => {
    switch (state.framework_ativo) {
      case 'GPCT': return GPCT_FIELD_LABELS;
      case 'BANT': return BANT_FIELD_LABELS;
      case 'SPIN': return SPIN_FIELD_LABELS;
      default: return {};
    }
  };

  const getFieldData = () => {
    switch (state.framework_ativo) {
      case 'GPCT': return state.framework_data.gpct || {};
      case 'BANT': return state.framework_data.bant || {};
      case 'SPIN': return state.framework_data.spin || {};
      default: return {};
    }
  };

  const fieldLabels = getFieldLabels();
  const fieldData = getFieldData();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Estado da Conversa
          </CardTitle>
          <Badge className={ESTADO_FUNIL_COLORS[state.estado_funil]}>
            {ESTADO_FUNIL_LABELS[state.estado_funil]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info básica */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">
            {state.canal}
          </Badge>
          {state.perfil_disc && (
            <Badge variant="secondary">
              DISC: {state.perfil_disc} - {DISC_LABELS[state.perfil_disc]?.nome}
            </Badge>
          )}
          <Badge variant="outline">
            {state.idioma_preferido === 'PT' ? '🇧🇷 PT' : 
             state.idioma_preferido === 'EN' ? '🇺🇸 EN' : '🇪🇸 ES'}
          </Badge>
        </div>

        {/* Framework Ativo */}
        {state.framework_ativo !== 'NONE' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{FRAMEWORK_LABELS[state.framework_ativo]}</p>
                {isLowCompleteness && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-sm">
                          Framework com menos de 25% de completude. A IA precisa coletar mais dados do lead para qualificar adequadamente.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {completeness.filled}/{completeness.total} campos
              </span>
            </div>
            <Progress value={completeness.percentage} className="h-2" />
            
            {/* Alerta de framework incompleto */}
            {isLowCompleteness && (
              <div className="flex items-center gap-2 p-2 rounded bg-warning/10 border border-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <p className="text-xs text-warning">
                  Framework incompleto — a IA precisa coletar mais informações para qualificação adequada.
                </p>
              </div>
            )}
            
            {/* Campos do Framework */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {Object.entries(fieldLabels).map(([key, label]) => {
                const value = fieldData[key as keyof typeof fieldData];
                const isFilled = !!value;
                
                return (
                  <div 
                    key={key}
                    className={`p-2 rounded border ${isFilled ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-muted/30 border-transparent'}`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      {isFilled ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium">{String(label)}</span>
                    </div>
                    {isFilled && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {String(value)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Última interação */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>
            Último contato:{' '}
            {format(new Date(state.ultimo_contato_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}