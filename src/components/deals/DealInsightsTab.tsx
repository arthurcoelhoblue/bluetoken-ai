import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, RefreshCw, Target, Brain, MessageSquare, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { DealFullDetail } from '@/types/deal';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';

interface InsightsTabProps {
  deal: DealFullDetail;
  dealId: string;
}

const DIMENSION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  stage_progress: { label: 'Progresso no Pipeline', icon: <Target className="h-3.5 w-3.5" /> },
  time_in_stage: { label: 'Tempo no Estágio', icon: <Target className="h-3.5 w-3.5" /> },
  engagement: { label: 'Engajamento', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  temperature: { label: 'Temperatura/ICP', icon: <Target className="h-3.5 w-3.5" /> },
  value_vs_ticket: { label: 'Valor vs Ticket', icon: <Target className="h-3.5 w-3.5" /> },
  sentiment: { label: 'Sentimento', icon: <Brain className="h-3.5 w-3.5" /> },
};

function scoreColor(value: number): string {
  if (value >= 70) return 'text-success';
  if (value >= 40) return 'text-warning';
  return 'text-destructive';
}

function progressColor(value: number): string {
  if (value >= 70) return '[&>div]:bg-success';
  if (value >= 40) return '[&>div]:bg-warning';
  return '[&>div]:bg-destructive';
}

export function InsightsTab({ deal, dealId }: InsightsTabProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const { trackFeatureUse } = useAnalyticsEvents();
  
  useEffect(() => {
    trackFeatureUse('deal_insights_viewed', { dealId });
  }, [trackFeatureUse, dealId]);

  const prob = deal.score_probabilidade ?? 0;
  const dimensoes = (deal as any).scoring_dimensoes as Record<string, number> | null;
  const proximaAcao = (deal as any).proxima_acao_sugerida as string | null;
  const scoringAt = (deal as any).scoring_updated_at as string | null;
  const contextoSdr = (deal as any).contexto_sdr as Record<string, any> | null;

  const handleRefreshScoring = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('deal-scoring', {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      toast.success('Scoring atualizado! Recarregue para ver.');
    } catch {
      toast.error('Erro ao atualizar scoring');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadContext = async () => {
    setLoadingContext(true);
    try {
      const { error } = await supabase.functions.invoke('deal-context-summary', {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      toast.success('Contexto SDR gerado! Recarregue para ver.');
    } catch {
      toast.error('Erro ao gerar contexto SDR');
    } finally {
      setLoadingContext(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Score principal */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Probabilidade de Fechamento
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefreshScoring}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${scoreColor(prob)}`}>
              {prob}%
            </div>
            <div className="flex-1">
              <Progress value={prob} className={`h-3 ${progressColor(prob)}`} />
              {scoringAt && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Atualizado em {new Date(scoringAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          {/* Proxima ação */}
          {proximaAcao && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs font-medium text-primary mb-1">Próxima Ação Sugerida</p>
              <p className="text-sm">{proximaAcao}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown 6 dimensões */}
      {dimensoes && Object.keys(dimensoes).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Breakdown por Dimensão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(dimensoes).map(([key, value]) => {
              const dim = DIMENSION_LABELS[key] || { label: key, icon: <Target className="h-3.5 w-3.5" /> };
              const numValue = typeof value === 'number' ? value : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {dim.icon}
                      {dim.label}
                    </span>
                    <span className={`font-medium ${scoreColor(numValue)}`}>{numValue}</span>
                  </div>
                  <Progress value={numValue} className={`h-1.5 ${progressColor(numValue)}`} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Scores legados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Scores Internos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: 'Engajamento', value: deal.score_engajamento },
            { label: 'Intenção', value: deal.score_intencao },
            { label: 'Valor', value: deal.score_valor },
            { label: 'Urgência', value: deal.score_urgencia },
          ].map(s => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium">{s.value ?? 0}/100</span>
              </div>
              <Progress value={s.value ?? 0} className="h-1.5" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contexto SDR */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Contexto SDR (Handoff)
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleLoadContext}
              disabled={loadingContext}
            >
              <RefreshCw className={`h-3 w-3 ${loadingContext ? 'animate-spin' : ''}`} />
              {contextoSdr ? 'Atualizar' : 'Gerar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contextoSdr ? (
            <Accordion type="multiple" className="w-full">
              {contextoSdr.resumo_conversa && (
                <AccordionItem value="resumo">
                  <AccordionTrigger className="text-xs py-2">Resumo da Conversa</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contextoSdr.resumo_conversa}</p>
                  </AccordionContent>
                </AccordionItem>
              )}
              {contextoSdr.perfil_disc && (
                <AccordionItem value="disc">
                  <AccordionTrigger className="text-xs py-2">Perfil DISC</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">{contextoSdr.perfil_disc}</p>
                  </AccordionContent>
                </AccordionItem>
              )}
              {contextoSdr.objecoes && (contextoSdr.objecoes as string[]).length > 0 && (
                <AccordionItem value="objecoes">
                  <AccordionTrigger className="text-xs py-2">
                    Objeções ({(contextoSdr.objecoes as string[]).length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1">
                      {(contextoSdr.objecoes as string[]).map((obj, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                          <span className="text-destructive mt-0.5">•</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}
              {contextoSdr.frameworks && (
                <AccordionItem value="frameworks">
                  <AccordionTrigger className="text-xs py-2">Frameworks de Vendas</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Framework:</strong> {(contextoSdr.frameworks as any).framework_ativo || 'N/A'}</p>
                      {(contextoSdr.frameworks as any).perguntas_respondidas?.length > 0 && (
                        <div>
                          <p className="font-medium text-foreground text-xs mb-1">Respondidas:</p>
                          <ul className="space-y-0.5">
                            {((contextoSdr.frameworks as any).perguntas_respondidas as string[]).map((p: string, i: number) => (
                              <li key={i} className="flex items-start gap-1"><span className="text-success">✓</span> {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(contextoSdr.frameworks as any).perguntas_pendentes?.length > 0 && (
                        <div>
                          <p className="font-medium text-foreground text-xs mb-1">Pendentes:</p>
                          <ul className="space-y-0.5">
                            {((contextoSdr.frameworks as any).perguntas_pendentes as string[]).map((p: string, i: number) => (
                              <li key={i} className="flex items-start gap-1"><span className="text-warning">○</span> {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
              {contextoSdr.sugestao_closer && (
                <AccordionItem value="sugestao">
                  <AccordionTrigger className="text-xs py-2">Sugestão para Closer</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">{contextoSdr.sugestao_closer}</p>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Clique em "Gerar" para criar o resumo de handoff SDR→Closer.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
