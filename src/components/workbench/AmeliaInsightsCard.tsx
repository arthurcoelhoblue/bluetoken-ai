import { useState } from 'react';
import { Brain, CheckCircle2, XCircle, AlertTriangle, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmeliaLearnings, useAmeliaSequenceAlerts, useRecentAlerts, useValidateLearning } from '@/hooks/useAmeliaLearnings';
import { LEARNING_TIPO_LABELS } from '@/types/learning';
import type { AmeliaLearning } from '@/types/learning';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

function SequenceDisplay({ eventos, matchPct }: { eventos: string[] | null; matchPct: number | null }) {
  if (!eventos || eventos.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5">
      {eventos.map((ev, i) => (
        <span key={i} className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {ev}
          </Badge>
          {i < eventos.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
        </span>
      ))}
      {matchPct != null && (
        <Badge variant="secondary" className="text-[10px] ml-1">
          {matchPct}%
        </Badge>
      )}
    </div>
  );
}

function LearningItem({ learning, onValidate }: { learning: AmeliaLearning; onValidate: (id: string, status: 'VALIDADO' | 'REJEITADO') => void }) {
  const navigate = useNavigate();
  const dados = learning.dados as Record<string, any>;
  const link = dados?.link || dados?.deal_id ? `/pipeline` : dados?.lead_id ? `/leads/${dados.lead_id}` : null;

  return (
    <div className="p-3 rounded-lg border space-y-2 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {LEARNING_TIPO_LABELS[learning.tipo] ?? learning.tipo}
            </span>
            <Badge
              variant={learning.confianca >= 0.7 ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {Math.round(learning.confianca * 100)}%
            </Badge>
          </div>
          <p className="text-sm font-medium mt-0.5 leading-tight">{learning.titulo}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{learning.descricao}</p>
        </div>
      </div>

      <SequenceDisplay eventos={learning.sequencia_eventos} matchPct={learning.sequencia_match_pct} />

      <div className="flex items-center gap-2 pt-1">
        {learning.status === 'PENDENTE' && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-success hover:text-success"
              onClick={() => onValidate(learning.id, 'VALIDADO')}
            >
              <CheckCircle2 className="h-3 w-3" /> Validar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
              onClick={() => onValidate(learning.id, 'REJEITADO')}
            >
              <XCircle className="h-3 w-3" /> Rejeitar
            </Button>
          </>
        )}
        {learning.status !== 'PENDENTE' && (
          <Badge variant={learning.status === 'VALIDADO' ? 'default' : 'destructive'} className="text-[10px]">
            {learning.status}
          </Badge>
        )}
        {link && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 ml-auto"
            onClick={() => navigate(link)}
          >
            <Link2 className="h-3 w-3" /> Ver
          </Button>
        )}
      </div>
    </div>
  );
}

export function AmeliaInsightsCard() {
  const [expanded, setExpanded] = useState(false);
  const { data: pendentes, isLoading: loadingPendentes } = useAmeliaLearnings('PENDENTE');
  const { data: sequenceAlerts, isLoading: loadingSeq } = useAmeliaSequenceAlerts();
  const { data: recentAlerts, isLoading: loadingAlerts } = useRecentAlerts();
  const validateMutation = useValidateLearning();

  const handleValidate = (id: string, status: 'VALIDADO' | 'REJEITADO') => {
    validateMutation.mutate({ id, status }, {
      onSuccess: () => toast.success(status === 'VALIDADO' ? 'Aprendizado validado!' : 'Aprendizado rejeitado'),
    });
  };

  const totalPendentes = pendentes?.length ?? 0;
  const totalAlerts = recentAlerts?.length ?? 0;
  const totalSequences = sequenceAlerts?.length ?? 0;
  const hasContent = totalPendentes > 0 || totalAlerts > 0 || totalSequences > 0;
  const isLoading = loadingPendentes || loadingSeq || loadingAlerts;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasContent) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            Insights da Amélia
            {totalPendentes > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {totalPendentes} pendente{totalPendentes > 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Critical Alerts */}
        {totalAlerts > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Alertas Críticos
            </p>
            {recentAlerts!.slice(0, 3).map(a => (
              <LearningItem key={a.id} learning={a} onValidate={handleValidate} />
            ))}
          </div>
        )}

        {/* Sequence Alerts */}
        {totalSequences > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
              ⛓️ Padrões de Sequência Ativos
            </p>
            {sequenceAlerts!.slice(0, expanded ? 10 : 3).map(s => (
              <LearningItem key={s.id} learning={s} onValidate={handleValidate} />
            ))}
          </div>
        )}

        {/* Pending Learnings */}
        {expanded && totalPendentes > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              📚 Aprendizados Pendentes de Validação
            </p>
            {pendentes!.slice(0, 5).map(l => (
              <LearningItem key={l.id} learning={l} onValidate={handleValidate} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
