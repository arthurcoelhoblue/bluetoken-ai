import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, DollarSign, Target, Clock, Ticket } from 'lucide-react';
import { usePipelines } from '@/hooks/usePipelines';
import {
  useAnalyticsFunnel,
  useAnalyticsConversion,
  useAnalyticsVendedor,
  useAnalyticsMotivosPerda,
  useAnalyticsCanalOrigem,
} from '@/hooks/useAnalytics';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();

  const { data: conversion, isLoading: loadingConversion } = useAnalyticsConversion(pipelineId);
  const { data: funnel, isLoading: loadingFunnel } = useAnalyticsFunnel(pipelineId);
  const { data: vendedores, isLoading: loadingVendedores } = useAnalyticsVendedor();
  const { data: canais, isLoading: loadingCanais } = useAnalyticsCanalOrigem(pipelineId);
  const { data: perdas, isLoading: loadingPerdas } = useAnalyticsMotivosPerda(pipelineId);

  // Aggregate KPIs from conversion data
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

  const kpis = [
    { label: 'Total Deals', value: totalDeals.toString(), icon: BarChart3 },
    { label: 'Win Rate', value: formatPercent(winRate), icon: TrendingUp },
    { label: 'Valor Ganho', value: formatCurrency(valorGanho), icon: DollarSign },
    { label: 'Pipeline Aberto', value: formatCurrency(valorAberto), icon: Target },
    { label: 'Ticket Médio', value: formatCurrency(ticketMedio), icon: Ticket },
    { label: 'Ciclo Médio', value: `${cicloMedio.toFixed(1)}d`, icon: Clock },
  ];

  const isLoading = loadingConversion || loadingPipelines;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
      {/* Pipeline filter */}
      <div className="flex items-center gap-3 mb-6">
        <Select value={pipelineId ?? 'all'} onValueChange={(v) => setPipelineId(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[240px]">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <kpi.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{kpi.label}</span>
                  </div>
                  <span className="text-xl font-bold">{kpi.value}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="funil" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="perdas">Perdas</TabsTrigger>
        </TabsList>

        {/* Tab Funil */}
        <TabsContent value="funil">
          <Card>
            <CardHeader><CardTitle className="text-base">Funil por Etapa</CardTitle></CardHeader>
            <CardContent>
              {loadingFunnel ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !funnel?.length ? (
                <p className="text-sm text-muted-foreground">Sem dados de funil.</p>
              ) : (
                <div className="space-y-3">
                  {funnel.map((stage) => {
                    const maxVal = Math.max(...funnel.map(s => s.deals_count), 1);
                    const pct = (stage.deals_count / maxVal) * 100;
                    return (
                      <div key={stage.stage_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{stage.stage_nome}</span>
                          <div className="flex items-center gap-3 text-muted-foreground text-xs">
                            <span>{stage.deals_count} deals</span>
                            <span>{formatCurrency(stage.deals_valor)}</span>
                            <span>{stage.tempo_medio_min.toFixed(0)}min</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Vendedores */}
        <TabsContent value="vendedores">
          <Card>
            <CardHeader><CardTitle className="text-base">Ranking Vendedores</CardTitle></CardHeader>
            <CardContent>
              {loadingVendedores ? (
                <Skeleton className="h-40 w-full" />
              ) : !vendedores?.length ? (
                <p className="text-sm text-muted-foreground">Sem dados de vendedores.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Ganhos</TableHead>
                      <TableHead className="text-right">Perdidos</TableHead>
                      <TableHead className="text-right">Abertos</TableHead>
                      <TableHead className="text-right">Valor Ganho</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                      <TableHead className="text-right">Ativ. 7d</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedores.map((v) => (
                      <TableRow key={v.user_id}>
                        <TableCell className="font-medium">{v.vendedor_nome}</TableCell>
                        <TableCell className="text-right">{v.deals_ganhos}</TableCell>
                        <TableCell className="text-right">{v.deals_perdidos}</TableCell>
                        <TableCell className="text-right">{v.deals_abertos}</TableCell>
                        <TableCell className="text-right">{formatCurrency(v.valor_ganho)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={v.win_rate >= 50 ? 'default' : 'secondary'}>
                            {formatPercent(v.win_rate)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{v.atividades_7d}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Canais */}
        <TabsContent value="canais">
          <Card>
            <CardHeader><CardTitle className="text-base">Performance por Canal</CardTitle></CardHeader>
            <CardContent>
              {loadingCanais ? (
                <Skeleton className="h-40 w-full" />
              ) : !canais?.length ? (
                <p className="text-sm text-muted-foreground">Sem dados de canais.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Ganhos</TableHead>
                      <TableHead className="text-right">Perdidos</TableHead>
                      <TableHead className="text-right">Valor Ganho</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {canais.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.canal}</TableCell>
                        <TableCell className="text-right">{c.total_deals}</TableCell>
                        <TableCell className="text-right">{c.deals_ganhos}</TableCell>
                        <TableCell className="text-right">{c.deals_perdidos}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.valor_ganho)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={c.win_rate >= 50 ? 'default' : 'secondary'}>
                            {formatPercent(c.win_rate)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Perdas */}
        <TabsContent value="perdas">
          <Card>
            <CardHeader><CardTitle className="text-base">Motivos de Perda</CardTitle></CardHeader>
            <CardContent>
              {loadingPerdas ? (
                <Skeleton className="h-40 w-full" />
              ) : !perdas?.length ? (
                <p className="text-sm text-muted-foreground">Sem dados de perdas.</p>
              ) : (
                <div className="space-y-3">
                  {perdas.map((p, i) => {
                    const maxQtd = Math.max(...perdas.map(x => x.quantidade), 1);
                    const pct = (p.quantidade / maxQtd) * 100;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.motivo}</span>
                            <Badge variant="outline" className="text-xs">{p.categoria}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-xs">
                            <span>{p.quantidade}x</span>
                            <span>{formatCurrency(p.valor_perdido)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-destructive/70 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>
  );
}
