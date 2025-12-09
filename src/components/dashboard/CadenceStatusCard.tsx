import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Play } from 'lucide-react';
import { SdrIaStats } from '@/hooks/useSdrIaStats';

interface CadenceStatusCardProps {
  stats: SdrIaStats | undefined;
  isLoading: boolean;
}

const STATUS_CONFIG = {
  Ativas: { color: 'hsl(var(--success))' },
  Pausadas: { color: 'hsl(var(--warning))' },
  Concluídas: { color: 'hsl(var(--primary))' },
  Canceladas: { color: 'hsl(var(--destructive))' },
};

export function CadenceStatusCard({ stats, isLoading }: CadenceStatusCardProps) {
  if (isLoading) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Status das Cadências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse h-full w-full bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: 'Ativas', value: stats?.cadenciasAtivas || 0 },
    { name: 'Pausadas', value: stats?.cadenciasPausadas || 0 },
    { name: 'Concluídas', value: stats?.cadenciasConcluidas || 0 },
    { name: 'Canceladas', value: stats?.cadenciasCanceladas || 0 },
  ];

  const hasData = chartData.some(d => d.value > 0);

  if (!hasData) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Status das Cadências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Sem cadências ainda
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          Status das Cadências
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_CONFIG[entry.name as keyof typeof STATUS_CONFIG]?.color}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
