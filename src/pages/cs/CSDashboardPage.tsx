import { PageShell } from '@/components/layout/PageShell';
import { useCSMetrics } from '@/hooks/useCSMetrics';
import { useCSIncidents } from '@/hooks/useCSIncidents';
import { useCSCustomers } from '@/hooks/useCSCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HeartPulse, Users, AlertCircle, CalendarClock, TrendingUp, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { healthStatusConfig } from '@/types/customerSuccess';
import { CSRevenueCard } from '@/components/cs/CSRevenueCard';
import { CSTrendingTopicsCard } from '@/components/cs/CSTrendingTopicsCard';
import { CSBenchmarkCard } from '@/components/cs/CSBenchmarkCard';
import { CSDailyBriefingCard } from '@/components/cs/CSDailyBriefingCard';

export default function CSDashboardPage() {
  const navigate = useNavigate();
  const { data: metrics, isLoading } = useCSMetrics();
  const { data: incidents } = useCSIncidents(undefined, 'ABERTA');
  const { data: riskyCustomers } = useCSCustomers({ health_status: 'CRITICO', is_active: true });
  const { data: churnRisk } = useCSCustomers({ is_active: true });

  // Top 5 by churn risk
  const topChurnRisk = (churnRisk?.data ?? [])
    .filter(c => (c.risco_churn_pct ?? 0) > 0)
    .sort((a, b) => (b.risco_churn_pct ?? 0) - (a.risco_churn_pct ?? 0))
    .slice(0, 5);

  const kpis = [
    { label: 'Clientes Ativos', value: metrics?.total_clientes ?? 0, icon: Users, color: 'text-primary' },
    { label: 'Health Médio', value: metrics?.health_medio ?? 0, icon: HeartPulse, color: 'text-chart-2', suffix: '/100' },
    { label: 'NPS Médio', value: metrics?.nps_medio ?? 0, icon: TrendingUp, color: 'text-chart-4' },
    { label: 'Em Risco', value: metrics?.clientes_em_risco ?? 0, icon: ShieldAlert, color: 'text-destructive' },
    { label: 'Renovações 30d', value: metrics?.renovacoes_30_dias ?? 0, icon: CalendarClock, color: 'text-chart-5' },
    { label: 'Incidências Abertas', value: incidents?.length ?? 0, icon: AlertCircle, color: 'text-orange-500' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <PageShell icon={HeartPulse} title="Customer Success" description="Visão geral da saúde da carteira de clientes" />

      <div className="px-6 pb-6 space-y-6">
        {/* Briefing IA */}
        <CSDailyBriefingCard />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="text-2xl font-bold">
                  {isLoading ? '—' : kpi.value}{kpi.suffix || ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue + Churn Risk row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CSRevenueCard />

          {/* Churn Risk Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Risco de Churn
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cs/clientes')}>Ver todos</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {topChurnRisk.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum cliente com risco calculado</p>
              )}
              {topChurnRisk.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/cs/clientes/${c.id}`)}
                >
                  <div>
                    <p className="font-medium text-sm">{c.contact?.nome || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">MRR: R$ {c.valor_mrr?.toLocaleString('pt-BR')}</p>
                  </div>
                  <Badge variant="outline" className={
                    (c.risco_churn_pct ?? 0) > 70 ? 'bg-red-100 text-red-800' :
                    (c.risco_churn_pct ?? 0) > 40 ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }>
                    {c.risco_churn_pct ?? 0}%
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clientes em Risco */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Clientes Críticos</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cs/clientes')}>Ver todos</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {riskyCustomers?.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum cliente em estado crítico 🎉</p>
              )}
              {riskyCustomers?.data?.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/cs/clientes/${c.id}`)}
                >
                  <div>
                    <p className="font-medium text-sm">{c.contact?.nome || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">MRR: R$ {c.valor_mrr?.toLocaleString('pt-BR')}</p>
                  </div>
                  <Badge className={healthStatusConfig[c.health_status]?.bgClass}>{c.health_score}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Incidências Abertas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Incidências Abertas</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cs/incidencias')}>Ver todas</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {incidents?.length === 0 && <p className="text-sm text-muted-foreground">Sem incidências abertas</p>}
              {incidents?.slice(0, 5).map((inc) => (
                <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{inc.titulo}</p>
                    <p className="text-xs text-muted-foreground">{(inc.customer as any)?.contact?.nome || 'Cliente'}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{inc.gravidade.toLowerCase()}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Trending + Benchmarks row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CSTrendingTopicsCard compact />
          <CSBenchmarkCard />
        </div>
      </div>
    </div>
  );
}
