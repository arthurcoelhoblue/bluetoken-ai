import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Zap, Clock, Target } from 'lucide-react';
import { SdrIaStats } from '@/hooks/useSdrIaStats';

interface SdrIaMetricsCardProps {
  stats: SdrIaStats | undefined;
  isLoading: boolean;
}

export function SdrIaMetricsCard({ stats, isLoading }: SdrIaMetricsCardProps) {
  const metrics = [
    {
      label: 'Interpretações Hoje',
      value: stats?.interpretacoesHoje ?? '-',
      icon: Brain,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Tempo Médio',
      value: stats?.tempoMedioProcessamento ? `${stats.tempoMedioProcessamento}ms` : '-',
      icon: Clock,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      label: 'Confiança Média',
      value: stats?.confiancaMedia ? `${stats.confiancaMedia}%` : '-',
      icon: Target,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Ações Aplicadas',
      value: stats?.acaoBreakdown?.reduce((sum, a) => sum + a.aplicada, 0) ?? '-',
      icon: Zap,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  if (isLoading) {
    return (
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            SDR IA Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          SDR IA Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className={`h-10 w-10 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
