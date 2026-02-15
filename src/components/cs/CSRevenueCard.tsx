import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCSRevenueForecast } from '@/hooks/useCSRevenueForecast';
import { useRevenueForecastEdge } from '@/hooks/useRevenueForecastEdge';
import { DollarSign, TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';

const COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--destructive))'];

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

export function CSRevenueCard() {
  const { data: localData } = useCSRevenueForecast();
  const { data: edgeData } = useRevenueForecastEdge();

  if (!localData && !edgeData) return null;

  // Se temos dados do edge function, exibimos forecast enriquecido
  const hasEdgeForecast = !!edgeData?.forecast_30d;

  const chartData = localData ? [
    { name: 'Saudável', mrr: localData.porSegmento.saudavel.mrr, count: localData.porSegmento.saudavel.count },
    { name: 'Atenção', mrr: localData.porSegmento.atencao.mrr, count: localData.porSegmento.atencao.count },
    { name: 'Em Risco', mrr: localData.porSegmento.emRisco.mrr, count: localData.porSegmento.emRisco.count },
    { name: 'Crítico', mrr: localData.porSegmento.critico.mrr, count: localData.porSegmento.critico.count },
  ] : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-chart-2" />
          Projeção de Receita
          {hasEdgeForecast && <Badge variant="outline" className="text-[10px] px-1.5 py-0">IA</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs principais */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">MRR Atual</p>
            <p className="text-lg font-bold">{fmt(edgeData?.mrr_total ?? localData?.mrrTotal ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" /> Projetado
            </p>
            <p className="text-lg font-bold text-chart-2">
              {fmt(edgeData?.mrr_retained ?? localData?.mrrProjetado ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3" /> Em Risco
            </p>
            <p className="text-lg font-bold text-destructive">
              {fmt(edgeData ? (edgeData.mrr_total - edgeData.mrr_retained) : (localData?.mrrEmRisco ?? 0))}
            </p>
          </div>
        </div>

        {/* Forecast 30d/90d do edge function */}
        {hasEdgeForecast && edgeData && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-2 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Forecast 30d</p>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Pessimista</span><span>{fmt(edgeData.forecast_30d.pessimista)}</span></div>
                <div className="flex justify-between font-semibold"><span>Realista</span><span className="text-chart-2">{fmt(edgeData.forecast_30d.realista)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Otimista</span><span>{fmt(edgeData.forecast_30d.otimista)}</span></div>
              </div>
            </div>
            <div className="rounded-lg border p-2 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Forecast 90d</p>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Pessimista</span><span>{fmt(edgeData.forecast_90d.pessimista)}</span></div>
                <div className="flex justify-between font-semibold"><span>Realista</span><span className="text-chart-2">{fmt(edgeData.forecast_90d.realista)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Otimista</span><span>{fmt(edgeData.forecast_90d.otimista)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline velocity do edge */}
        {edgeData && (
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Velocidade Pipeline</span>
            <span className="font-medium text-foreground">{fmt(edgeData.pipeline_velocity_daily)}/dia</span>
            <span>Ciclo médio: {edgeData.avg_close_days}d</span>
          </div>
        )}

        {/* Gráfico de segmentos (dados locais) */}
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => fmt(value)}
                labelFormatter={(label) => `Segmento: ${label}`}
              />
              <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {localData && localData.renovacoes90d.count > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            📅 {localData.renovacoes90d.count} renovações nos próx. 90 dias ({fmt(localData.renovacoes90d.mrr)})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
