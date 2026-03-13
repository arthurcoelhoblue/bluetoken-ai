import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, DollarSign, Target, Clock, Ticket, AlertTriangle, Trophy, XCircle, Radio } from 'lucide-react';
import { usePipelines } from '@/hooks/usePipelines';
import {
  useAnalyticsConversion,
  useAnalyticsFunnel,
  useAnalyticsVendedor,
  useAnalyticsMotivosPerda,
  useAnalyticsCanalOrigem,
  useAnalyticsEvolucao,
} from '@/hooks/useAnalytics';
import { useWorkbenchSLAAlerts } from '@/hooks/useWorkbench';
import { EvolutionChart } from '@/components/analytics/EvolutionChart';
import { CriticalAlerts } from '@/components/cockpit/CriticalAlerts';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function CockpitContent() {
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const { data: pipelines } = usePipelines();

  const { data: conversion, isLoading: loadingConversion } = useAnalyticsConversion(pipelineId);
  const { data: funnel, isLoading: loadingFunnel } = useAnalyticsFunnel(pipelineId);
  const { data: vendedores, isLoading: loadingVendedores } = useAnalyticsVendedor();
  const { data: perdas, isLoading: loadingPerdas } = useAnalyticsMotivosPerda(pipelineId);
  const { data: canais, isLoading: loadingCanais } = useAnalyticsCanalOrigem(pipelineId);
  const { data: evolucao, isLoading: loadingEvolucao } = useAnalyticsEvolucao(pipelineId);
  const { data: slaAlerts, isLoading: loadingSLA } = useWorkbenchSLAAlerts();

  const totalDeals = conversion?.reduce((s, c) => s + c.total_deals, 0) ?? 0;
  const totalGanhos = conversion?.reduce((s, c) => s + c.deals_ganhos, 0) ?? 0;
  const totalFechados = conversion?.reduce((s, c) => s + c.deals_ganhos + c.deals_perdidos, 0) ?? 0;
  const winRate = totalFechados > 0 ? (totalGanhos / totalFechados) * 100 : 0;
  const valorGanho = conversion?.reduce((s, c) => s + c.valor_ganho, 0) ?? 0;
  const valorAberto = conversion?.reduce((s, c) => s + c.valor_pipeline_aberto, 0) ?? 0;
  const ticketMedio = totalGanhos > 0 ? valorGanho / totalGanhos : 0;
  const cicloMedio = conversion && conversion.length > 0
    ? conversion.reduce((s, c) => s + c.ciclo_medio_dias, 0) / conversion.length
    : 0;

  const isLoading = loadingConversion;

  const kpis = [
    { label: 'Total Deals', value: totalDeals.toString(), icon: BarChart3, color: 'text-primary' },
    { label: 'Win Rate', value: formatPercent(winRate), icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Valor Ganho', value: formatCurrency(valorGanho), icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Pipeline Aberto', value: formatCurrency(valorAberto), icon: Target, color: 'text-blue-500' },
    { label: 'Ticket Médio', value: formatCurrency(ticketMedio), icon: Ticket, color: 'text-amber-500' },
    { label: 'Ciclo Médio', value: `${cicloMedio.toFixed(1)}d`, icon: Clock, color: 'text-violet-500' },
  ];

  const topFunnel = funnel?.slice(0, 5) ?? [];
  const topVendedores = vendedores?.slice(0, 5) ?? [];
  const topPerdas = perdas?.slice(0, 5) ?? [];
  const topCanais = canais?.slice(0, 5) ?? [];
  const slaCount = slaAlerts?.length ?? 0;

  return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Cockpit Executivo</h1>
          <Select value={pipelineId ?? 'all'} onValueChange={(v) => setPipelineId(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os funis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funis</SelectItem>
              {pipelines?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                {isLoading ? <Skeleton className="h-12 w-full" /> : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                      <span className="text-xs font-medium">{kpi.label}</span>
                    </div>
                    <span className="text-xl font-bold">{kpi.value}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alertas Críticos */}
        <CriticalAlerts />

        {/* Row 1: Funnel + Evolution */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Funil Resumido
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFunnel ? <Skeleton className="h-40 w-full" /> : !topFunnel.length ? (
                <p className="text-sm text-muted-foreground">Sem dados de funil.</p>
              ) : (
                <div className="space-y-3">
                  {topFunnel.map((stage) => {
                    const maxVal = Math.max(...topFunnel.map(s => s.deals_count), 1);
                    const pct = (stage.deals_count / maxVal) * 100;
                    return (
                      <div key={stage.stage_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[160px]">{stage.stage_nome}</span>
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <span>{stage.deals_count}</span>
                            <span>{formatCurrency(stage.deals_valor)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Evolução Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EvolutionChart data={evolucao} isLoading={loadingEvolucao} />
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Vendedores + Perdas */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top 5 Vendedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingVendedores ? <Skeleton className="h-40 w-full" /> : !topVendedores.length ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <div className="space-y-3">
                  {topVendedores.map((v, i) => (
                    <div key={v.user_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                        <span className="text-sm font-medium truncate max-w-[140px]">{v.vendedor_nome}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{v.deals_ganhos}W</span>
                        <Badge variant={v.win_rate >= 50 ? 'default' : 'secondary'} className="text-xs">
                          {formatPercent(v.win_rate)}
                        </Badge>
                        <span className="font-medium text-foreground">{formatCurrency(v.valor_ganho)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Motivos de Perda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPerdas ? <Skeleton className="h-40 w-full" /> : !topPerdas.length ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <div className="space-y-3">
                  {topPerdas.map((p, i) => {
                    const maxQtd = Math.max(...topPerdas.map(x => x.quantidade), 1);
                    const pct = (p.quantidade / maxQtd) * 100;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[160px]">{p.motivo}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{p.quantidade}x</span>
                            <span>{formatCurrency(p.valor_perdido)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-destructive/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Canais + SLA */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-blue-500" />
                Canais de Origem
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCanais ? <Skeleton className="h-32 w-full" /> : !topCanais.length ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {topCanais.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.canal}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{c.total_deals} deals</span>
                        <Badge variant={c.win_rate >= 50 ? 'default' : 'secondary'} className="text-xs">
                          {formatPercent(c.win_rate)}
                        </Badge>
                        <span className="font-medium text-foreground">{formatCurrency(c.valor_ganho)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas SLA
                {!loadingSLA && slaCount > 0 && (
                  <Badge variant="destructive" className="ml-2">{slaCount}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSLA ? <Skeleton className="h-32 w-full" /> : !slaAlerts?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum alerta de SLA ativo. 🎉</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {slaAlerts.slice(0, 8).map((alert) => (
                    <div key={alert.deal_id} className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[180px]">{alert.deal_titulo}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{alert.stage_nome}</Badge>
                        <Badge variant="destructive">{alert.sla_percentual?.toFixed(0)}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

export default function CockpitPage() {
  return (
    <AppLayout>
      <CockpitContent />
    </AppLayout>
  );
}
