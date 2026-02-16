import { useState, useEffect } from 'react';
import { IcpInsightsCard } from '@/components/analytics/IcpInsightsCard';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, Target, Percent, Clock, Users, HeartPulse, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAnalyticsConversion, useAnalyticsEvolucao } from '@/hooks/useAnalytics';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface KpiItem {
  label: string;
  value: string;
  delta?: number;
  icon: React.ElementType;
  sparkline?: number[];
}

interface WeeklyReportData {
  narrative?: string;
  generated_at?: string;
}

interface CSCustomerRow {
  valor_mrr: number | null;
  risco_churn_pct: number | null;
  ultimo_nps: number | null;
}

export default function AnalyticsExecutivoPage() {
  const { activeCompany } = useCompany();
  const empresa = activeCompany === 'ALL' ? null : activeCompany;
  const { data: conversion } = useAnalyticsConversion();
  const { data: evolucao } = useAnalyticsEvolucao();
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [csData, setCsData] = useState<{ mrrTotal: number; churnRiskAvg: number; npsAvg: number | null } | null>(null);

  // Load weekly report from system_settings
  useEffect(() => {
    async function loadReport() {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'weekly_report')
        .maybeSingle();
      if (data?.value) setWeeklyReport(data.value as WeeklyReportData);
    }
    loadReport();
  }, [empresa]);

  // Load CS data
  useEffect(() => {
    async function loadCS() {
      let q = supabase.from('cs_customers').select('valor_mrr, risco_churn_pct, ultimo_nps').eq('is_active', true);
      if (empresa) q = q.eq('empresa', empresa);
      const { data } = await q.limit(500);
      if (data) {
        const rows = data as CSCustomerRow[];
        const mrrTotal = rows.reduce((s, c) => s + (c.valor_mrr || 0), 0);
        const risks = rows.filter((c) => c.risco_churn_pct != null);
        const churnRiskAvg = risks.length > 0 ? risks.reduce((s, c) => s + (c.risco_churn_pct ?? 0), 0) / risks.length : 0;
        const npsVals = rows.filter((c) => c.ultimo_nps != null).map((c) => c.ultimo_nps as number);
        const npsAvg = npsVals.length > 0 ? npsVals.reduce((a, b) => a + b, 0) / npsVals.length : null;
        setCsData({ mrrTotal, churnRiskAvg, npsAvg });
      }
    }
    loadCS();
  }, [empresa]);

  const handleRefreshReport = async () => {
    setLoadingReport(true);
    try {
      const { error } = await supabase.functions.invoke('weekly-report', { body: {} });
      if (error) throw error;
      toast.success('Relatório atualizado!');
      // Reload
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'weekly_report')
        .maybeSingle();
      if (data?.value) setWeeklyReport(data.value as WeeklyReportData);
    } catch {
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoadingReport(false);
    }
  };

  // Build KPIs
  const totalGanhos = conversion?.reduce((s, c) => s + c.deals_ganhos, 0) ?? 0;
  const totalFechados = conversion?.reduce((s, c) => s + c.deals_ganhos + c.deals_perdidos, 0) ?? 0;
  const winRate = totalFechados > 0 ? (totalGanhos / totalFechados) * 100 : 0;
  const valorGanho = conversion?.reduce((s, c) => s + c.valor_ganho, 0) ?? 0;
  const valorAberto = conversion?.reduce((s, c) => s + c.valor_pipeline_aberto, 0) ?? 0;
  const ticketMedio = totalGanhos > 0 ? valorGanho / totalGanhos : 0;
  const cicloMedio = conversion?.length ? conversion.reduce((s, c) => s + c.ciclo_medio_dias, 0) / conversion.length : 0;
  const mrr = csData?.mrrTotal ?? 0;
  const arr = mrr * 12;

  // Sparklines from evolucao (last 6 months)
  const sortedEvolucao = [...(evolucao ?? [])].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6);
  const sparkGanho = sortedEvolucao.map(e => e.valor_ganho);
  const sparkWinRate = sortedEvolucao.map(e => e.win_rate);
  const sparkTicket = sortedEvolucao.map(e => e.ticket_medio);

  // Deltas (current vs previous month)
  const curMonth = sortedEvolucao[sortedEvolucao.length - 1];
  const prevMonth = sortedEvolucao[sortedEvolucao.length - 2];
  const deltaWinRate = curMonth && prevMonth ? curMonth.win_rate - prevMonth.win_rate : undefined;
  const deltaValor = curMonth && prevMonth && prevMonth.valor_ganho > 0
    ? ((curMonth.valor_ganho - prevMonth.valor_ganho) / prevMonth.valor_ganho) * 100
    : undefined;

  const kpis: KpiItem[] = [
    { label: 'ARR', value: formatCurrency(arr), icon: DollarSign, sparkline: sparkGanho },
    { label: 'MRR', value: formatCurrency(mrr), icon: DollarSign },
    { label: 'Pipeline Aberto', value: formatCurrency(valorAberto), icon: Target },
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, icon: Percent, delta: deltaWinRate, sparkline: sparkWinRate },
    { label: 'Ticket Médio', value: formatCurrency(ticketMedio), icon: DollarSign, sparkline: sparkTicket },
    { label: 'Ciclo Médio', value: `${cicloMedio.toFixed(0)}d`, icon: Clock },
    { label: 'Churn Risk', value: `${(csData?.churnRiskAvg ?? 0).toFixed(0)}%`, icon: HeartPulse },
    { label: 'NPS Médio', value: csData?.npsAvg != null ? csData.npsAvg.toFixed(1) : '—', icon: Users },
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard Executivo</h1>
          <Button variant="outline" size="sm" onClick={handleRefreshReport} disabled={loadingReport}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingReport ? 'animate-spin' : ''}`} />
            Gerar Relatório
          </Button>
        </div>

        {/* 8 KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <kpi.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{kpi.label}</span>
                  {kpi.delta !== undefined && (
                    <Badge variant={kpi.delta >= 0 ? 'default' : 'destructive'} className="text-[10px] px-1 py-0 ml-auto">
                      {kpi.delta >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5 inline" /> : <TrendingDown className="h-3 w-3 mr-0.5 inline" />}
                      {kpi.delta >= 0 ? '+' : ''}{kpi.delta.toFixed(1)}%
                    </Badge>
                  )}
                </div>
                <span className="text-2xl font-bold">{kpi.value}</span>
                {kpi.sparkline && kpi.sparkline.length > 1 && (
                  <div className="h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={kpi.sparkline.map((v, i) => ({ v, i }))}>
                        <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Weekly Report Narrative */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Relatório Semanal IA</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyReport?.narrative ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{weeklyReport.narrative}</p>
                {weeklyReport.generated_at && (
                  <p className="text-xs text-muted-foreground/60">
                    Gerado em: {new Date(weeklyReport.generated_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum relatório gerado ainda. Clique em "Gerar Relatório" para criar o primeiro.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ICP Insights */}
        <div className="h-full">
          <IcpInsightsCard />
        </div>
      </div>
    </AppLayout>
  );
}
