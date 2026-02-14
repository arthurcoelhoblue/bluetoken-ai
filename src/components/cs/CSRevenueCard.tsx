import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCSRevenueForecast } from '@/hooks/useCSRevenueForecast';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--destructive))'];

export function CSRevenueCard() {
  const { data } = useCSRevenueForecast();
  if (!data) return null;

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

  const chartData = [
    { name: 'Saudável', mrr: data.porSegmento.saudavel.mrr, count: data.porSegmento.saudavel.count },
    { name: 'Atenção', mrr: data.porSegmento.atencao.mrr, count: data.porSegmento.atencao.count },
    { name: 'Em Risco', mrr: data.porSegmento.emRisco.mrr, count: data.porSegmento.emRisco.count },
    { name: 'Crítico', mrr: data.porSegmento.critico.mrr, count: data.porSegmento.critico.count },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-chart-2" />
          Projeção de Receita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">MRR Atual</p>
            <p className="text-lg font-bold">{fmt(data.mrrTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" /> Projetado
            </p>
            <p className="text-lg font-bold text-chart-2">{fmt(data.mrrProjetado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3" /> Em Risco
            </p>
            <p className="text-lg font-bold text-destructive">{fmt(data.mrrEmRisco)}</p>
          </div>
        </div>

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

        {data.renovacoes90d.count > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            📅 {data.renovacoes90d.count} renovações nos próx. 90 dias ({fmt(data.renovacoes90d.mrr)})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
