import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface EvolucaoData {
  mes: string;
  deals_ganhos: number;
  deals_perdidos: number;
  valor_ganho: number;
  win_rate: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function formatMonth(mes: string) {
  const [, m] = mes.split('-');
  const names = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[parseInt(m)] || m;
}

export function EvolutionChart({ data, isLoading }: { data?: EvolucaoData[]; isLoading: boolean }) {
  const [period, setPeriod] = useState<6 | 12>(12);

  if (isLoading) return <Skeleton className="h-[300px] w-full" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados de evolução.</p>;

  const sorted = [...data].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-period);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant={period === 6 ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriod(6)}
        >
          6 meses
        </Button>
        <Button
          variant={period === 12 ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriod(12)}
        >
          12 meses
        </Button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={sorted}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tickFormatter={formatMonth} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'valor_ganho') return [formatCurrency(value), 'Valor Ganho'];
              if (name === 'win_rate') return [`${value}%`, 'Win Rate'];
              if (name === 'deals_ganhos') return [value, 'Ganhos'];
              if (name === 'deals_perdidos') return [value, 'Perdidos'];
              return [value, name];
            }}
          />
          <Legend />
          <Area yAxisId="left" type="monotone" dataKey="valor_ganho" fill="hsl(var(--success) / 0.15)" stroke="hsl(var(--success))" name="valor_ganho" />
          <Line yAxisId="left" type="monotone" dataKey="deals_ganhos" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} name="deals_ganhos" />
          <Line yAxisId="left" type="monotone" dataKey="deals_perdidos" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} name="deals_perdidos" />
          <Line yAxisId="right" type="monotone" dataKey="win_rate" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="win_rate" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
