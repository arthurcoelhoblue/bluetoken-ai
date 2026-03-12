import { useState, useEffect, useCallback } from 'react';
import { X, Maximize, Minimize } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import {
  useAnalyticsConversion,
  useAnalyticsFunnel,
  useAnalyticsVendedor,
} from '@/hooks/useAnalytics';
import { useDealsCreatedPerDay } from '@/hooks/useDealsCreatedPerDay';

const EMPRESAS = ['TODAS', 'BLUE', 'TOKENIZA', 'MPUPPE', 'AXIA'] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

interface TVDashboardProps {
  onClose: () => void;
}

export function TVDashboard({ onClose }: TVDashboardProps) {
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Hide cursor after 3s inactivity
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const show = () => {
      setCursorVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setCursorVisible(false), 3000);
    };
    window.addEventListener('mousemove', show);
    timeout = setTimeout(() => setCursorVisible(false), 3000);
    return () => {
      window.removeEventListener('mousemove', show);
      clearTimeout(timeout);
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  // Data — TV mode uses its own refetchInterval
  const empresaFilter = empresa || undefined;
  // For analytics hooks that use CompanyContext, we pass pipeline filter as null
  // For deals per day we filter by empresa directly
  const { data: conversion } = useAnalyticsConversion(null);
  const { data: funnel } = useAnalyticsFunnel(null);
  const { data: vendedores } = useAnalyticsVendedor();
  const { data: dealsPerDay } = useDealsCreatedPerDay(empresaFilter);

  // Filter by empresa manually since hooks use CompanyContext
  const filteredConversion = empresa
    ? conversion?.filter(c => c.empresa === empresa)
    : conversion;

  const filteredFunnel = empresa
    ? funnel?.filter(f => f.empresa === empresa)
    : funnel;

  const filteredVendedores = empresa
    ? vendedores?.filter(v => v.empresa === empresa)
    : vendedores;

  // KPIs
  const totalGanhos = filteredConversion?.reduce((s, c) => s + c.deals_ganhos, 0) ?? 0;
  const totalFechados = filteredConversion?.reduce((s, c) => s + c.deals_ganhos + c.deals_perdidos, 0) ?? 0;
  const winRate = totalFechados > 0 ? (totalGanhos / totalFechados) * 100 : 0;
  const valorGanho = filteredConversion?.reduce((s, c) => s + c.valor_ganho, 0) ?? 0;
  const valorAberto = filteredConversion?.reduce((s, c) => s + c.valor_pipeline_aberto, 0) ?? 0;
  const ticketMedio = totalGanhos > 0 ? valorGanho / totalGanhos : 0;

  const topFunnel = filteredFunnel?.slice(0, 6) ?? [];
  const topVendedores = filteredVendedores?.slice(0, 5) ?? [];

  const kpis = [
    { label: 'Vendas do Mês', value: totalGanhos.toString(), emoji: '🏆' },
    { label: 'Receita Total', value: formatCurrency(valorGanho), emoji: '💰' },
    { label: 'Win Rate', value: formatPercent(winRate), emoji: '📊' },
    { label: 'Pipeline Aberto', value: formatCurrency(valorAberto), emoji: '🎯' },
    { label: 'Ticket Médio', value: formatCurrency(ticketMedio), emoji: '🎟️' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-950 text-white overflow-auto"
      style={{ cursor: cursorVisible ? 'default' : 'none' }}
    >
      <div className="p-4 md:p-6 lg:p-8 space-y-6 min-h-full">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📺</span>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">
              PAINEL DE VENDAS
            </h1>
          </div>

          <Tabs
            value={empresa ?? 'TODAS'}
            onValueChange={(v) => setEmpresa(v === 'TODAS' ? null : v)}
          >
            <TabsList className="bg-gray-800 border border-gray-700">
              {EMPRESAS.map((e) => (
                <TabsTrigger
                  key={e}
                  value={e}
                  className="text-xs md:text-sm data-[state=active]:bg-gray-600 data-[state=active]:text-white text-gray-400"
                >
                  {e}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            <span className="text-lg md:text-xl font-mono text-gray-400">
              {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6"
            >
              <div className="text-xs md:text-sm text-gray-400 mb-1 flex items-center gap-2">
                <span>{kpi.emoji}</span>
                {kpi.label}
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid: Ranking + Funil + Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ranking */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6">
            <h2 className="text-sm md:text-base font-semibold text-gray-300 mb-4 flex items-center gap-2">
              🏆 RANKING VENDEDORES
            </h2>
            <div className="space-y-3">
              {topVendedores.map((v, i) => {
                const maxVal = Math.max(...topVendedores.map(x => x.valor_ganho), 1);
                const pct = (v.valor_ganho / maxVal) * 100;
                return (
                  <div key={v.user_id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${i === 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                          #{i + 1}
                        </span>
                        <span className="text-sm md:text-base font-medium truncate max-w-[140px]">
                          {v.vendedor_nome}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs md:text-sm">
                        <span className="text-emerald-400">{v.deals_ganhos}W</span>
                        <span className="font-semibold">{formatCurrency(v.valor_ganho)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${i === 0 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {!topVendedores.length && (
                <p className="text-sm text-gray-500">Sem dados.</p>
              )}
            </div>
          </div>

          {/* Funil */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6">
            <h2 className="text-sm md:text-base font-semibold text-gray-300 mb-4 flex items-center gap-2">
              📈 FUNIL DE VENDAS
            </h2>
            <div className="space-y-3">
              {topFunnel.map((stage) => {
                const maxVal = Math.max(...topFunnel.map(s => s.deals_count), 1);
                const pct = (stage.deals_count / maxVal) * 100;
                return (
                  <div key={stage.stage_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[140px]">{stage.stage_nome}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{stage.deals_count}</span>
                        <span>{formatCurrency(stage.deals_valor)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {!topFunnel.length && (
                <p className="text-sm text-gray-500">Sem dados.</p>
              )}
            </div>
          </div>

          {/* Negócios por dia */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6">
            <h2 className="text-sm md:text-base font-semibold text-gray-300 mb-4 flex items-center gap-2">
              📅 NEGÓCIOS CRIADOS / DIA
            </h2>
            {dealsPerDay && dealsPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dealsPerDay}>
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Negócios" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">Sem dados.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
