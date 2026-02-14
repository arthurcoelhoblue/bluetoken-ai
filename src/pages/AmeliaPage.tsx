import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Bot, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSdrIaStats } from '@/hooks/useSdrIaStats';
import { SdrIaMetricsCard } from '@/components/dashboard/SdrIaMetricsCard';
import { IntentChartCard } from '@/components/dashboard/IntentChartCard';
import { MessagesChartCard } from '@/components/dashboard/MessagesChartCard';
import { CadenceStatusCard } from '@/components/dashboard/CadenceStatusCard';
import { ActionsBreakdownCard } from '@/components/dashboard/ActionsBreakdownCard';
import { LeadsQuentesCard } from '@/components/dashboard/LeadsQuentesCard';

export default function AmeliaPage() {
  const navigate = useNavigate();
  const { data: sdrStats, isLoading: sdrStatsLoading } = useSdrIaStats();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <PageShell
          icon={Bot}
          title="Amélia IA"
          description="Central de operações da SDR IA. Métricas, conversas ativas e ações em massa."
          patchInfo="Patch 6 + 12"
        />

        {/* Quick Action: Mass Action */}
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/amelia/mass-action')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Ação em Massa</h3>
              <p className="text-sm text-muted-foreground">Selecione deals e gere mensagens personalizadas com IA</p>
            </div>
            <Button variant="outline">Acessar</Button>
          </CardContent>
        </Card>

        {/* SDR IA Metrics */}
        <SdrIaMetricsCard stats={sdrStats} isLoading={sdrStatsLoading} />

        {/* Leads Quentes */}
        <LeadsQuentesCard />

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          <IntentChartCard data={sdrStats?.intentBreakdown} isLoading={sdrStatsLoading} />
          <CadenceStatusCard stats={sdrStats} isLoading={sdrStatsLoading} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <MessagesChartCard data={sdrStats?.mensagensPorDia} isLoading={sdrStatsLoading} />
          <ActionsBreakdownCard data={sdrStats?.acaoBreakdown} isLoading={sdrStatsLoading} />
        </div>
      </div>
    </AppLayout>
  );
}
