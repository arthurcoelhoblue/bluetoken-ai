import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Repeat, TrendingUp, DollarSign, Target, BarChart3, Info } from 'lucide-react';
import { usePipelines } from '@/hooks/usePipelines';
import {
  useAnalyticsConversion,
  useAnalyticsMotivosPerda,
  useAnalyticsVendedor,
} from '@/hooks/useAnalytics';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function RenovacaoContent() {
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();

  // Tenta encontrar um pipeline de renovação pelo nome
  const renovacaoPipeline = pipelines?.find(
    (p) => p.nome.toLowerCase().includes('renova') || p.nome.toLowerCase().includes('churn')
  );
  const pipelineId = renovacaoPipeline?.id ?? null;

  const { data: conversion, isLoading: loadingConversion } = useAnalyticsConversion(pipelineId);
  const { data: perdas, isLoading: loadingPerdas } = useAnalyticsMotivosPerda(pipelineId);
  const { data: vendedores, isLoading: loadingVendedores } = useAnalyticsVendedor();

  const isLoading = loadingPipelines || loadingConversion;

  if (!loadingPipelines && !renovacaoPipeline) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Repeat className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Renovação & Churn</h1>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Nenhum pipeline de renovação encontrado</AlertTitle>
          <AlertDescription>
            Para usar este dashboard, crie um pipeline com "Renovação" no nome em Configurações → Pipeline.
            Os KPIs e análises serão calculados automaticamente a partir dos deals desse funil.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalDeals = conversion?.reduce((s, c) => s + c.total_deals, 0) ?? 0;
  const totalGanhos = conversion?.reduce((s, c) => s + c.deals_ganhos, 0) ?? 0;
  const totalFechados = conversion?.reduce((s, c) => s + c.deals_ganhos + c.deals_perdidos, 0) ?? 0;
  const winRate = totalFechados > 0 ? (totalGanhos / totalFechados) * 100 : 0;
  const valorGanho = conversion?.reduce((s, c) => s + c.valor_ganho, 0) ?? 0;
  const valorAberto = conversion?.reduce((s, c) => s + c.valor_pipeline_aberto, 0) ?? 0;

  const kpis = [
    { label: 'Renovações Enviadas', value: totalDeals.toString(), icon: Repeat },
    { label: 'Convertidas', value: totalGanhos.toString(), icon: TrendingUp },
    { label: 'Taxa de Conversão', value: formatPercent(winRate), icon: Target },
    { label: 'Receita Renovada', value: formatCurrency(valorGanho), icon: DollarSign },
    { label: 'Pipeline Aberto', value: formatCurrency(valorAberto), icon: BarChart3 },
  ];

  const topPerdas = perdas?.slice(0, 8) ?? [];

  // Filtrar vendedores que tenham deals nesse pipeline (aproximação: todos)
  const topVendedores = vendedores?.slice(0, 10) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Repeat className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Renovação & Churn</h1>
          {renovacaoPipeline && (
            <p className="text-sm text-muted-foreground">Pipeline: {renovacaoPipeline.nome}</p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Motivos de Não Renovação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Motivos de Não Renovação</CardTitle>
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
                        <span className="font-medium truncate max-w-[200px]">{p.motivo}</span>
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

        {/* Performance por Vendedor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Performance por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVendedores ? <Skeleton className="h-40 w-full" /> : !topVendedores.length ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ganhos</TableHead>
                    <TableHead className="text-right">Perdidos</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topVendedores.map((v) => (
                    <TableRow key={v.user_id}>
                      <TableCell className="font-medium">{v.vendedor_nome}</TableCell>
                      <TableCell className="text-right">{v.deals_ganhos}</TableCell>
                      <TableCell className="text-right">{v.deals_perdidos}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={v.win_rate >= 50 ? 'default' : 'secondary'}>
                          {formatPercent(v.win_rate)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(v.valor_ganho)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RenovacaoPage() {
  return (
    <AppLayout>
      <RenovacaoContent />
    </AppLayout>
  );
}
