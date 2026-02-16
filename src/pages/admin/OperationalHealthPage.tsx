import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCcw, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useOperationalHealth } from '@/hooks/useOperationalHealth';
import { useWebVitals, useEdgeFunctionLatency } from '@/hooks/useObservabilityData';
import { WebVitalsCard } from '@/components/observability/WebVitalsCard';
import { EdgeFunctionLatencyCard } from '@/components/observability/EdgeFunctionLatencyCard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  online: { icon: <CheckCircle2 className="h-4 w-4" />, className: 'text-success bg-success/10', label: 'Online' },
  offline: { icon: <XCircle className="h-4 w-4" />, className: 'text-destructive bg-destructive/10', label: 'Offline' },
  error: { icon: <AlertTriangle className="h-4 w-4" />, className: 'text-warning bg-warning/10', label: 'Erro' },
  checking: { icon: <Loader2 className="h-4 w-4 animate-spin" />, className: 'text-muted-foreground bg-muted', label: 'Verificando' },
  unknown: { icon: <Clock className="h-4 w-4" />, className: 'text-muted-foreground bg-muted', label: 'Pendente' },
};

export default function OperationalHealthPage() {
  const { integrations, cronStatuses, loading, checkAll } = useOperationalHealth();
  const { data: webVitals, isLoading: loadingVitals } = useWebVitals();
  const { data: edgeFnData, isLoading: loadingEdgeFn } = useEdgeFunctionLatency();

  useEffect(() => { checkAll(); }, [checkAll]);

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <PageShell icon={Activity} title="Saúde Operacional" description="Web Vitals, integrações, CRON jobs e latência de Edge Functions" />
        <div className="px-6 pb-6 space-y-6">
          <div className="flex justify-end">
            <Button onClick={checkAll} disabled={loading} variant="outline" size="sm">
              <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Verificar Agora
            </Button>
          </div>

          {/* Web Vitals + Edge Function Latency */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WebVitalsCard vitals={webVitals || []} loading={loadingVitals} />
            <EdgeFunctionLatencyCard data={edgeFnData || []} loading={loadingEdgeFn} />
          </div>

          {/* Integrations Grid */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Integrações</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {integrations.map(int => {
                const cfg = STATUS_CONFIG[int.status] || STATUS_CONFIG.unknown;
                return (
                  <Card key={int.name}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{int.label}</span>
                        <Badge className={cfg.className}>{cfg.icon}<span className="ml-1">{cfg.label}</span></Badge>
                      </div>
                      {int.latencyMs != null && (
                        <p className="text-xs text-muted-foreground">{int.latencyMs}ms</p>
                      )}
                      {int.message && <p className="text-xs text-muted-foreground truncate">{int.message}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* CRON Jobs */}
          <div>
            <h3 className="text-sm font-semibold mb-3">CRON Jobs ({cronStatuses.length})</h3>
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {cronStatuses.map(cron => (
                    <div key={cron.functionName} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        {(cron.consecutiveFailures || 0) > 0 ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        )}
                        <span className="text-sm font-mono">{cron.functionName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {cron.lastRun && <span>{format(new Date(cron.lastRun), "dd/MM HH:mm", { locale: ptBR })}</span>}
                        {(cron.consecutiveFailures || 0) > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1">{cron.consecutiveFailures} falhas</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {cronStatuses.length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2 text-center py-4">Clique em "Verificar Agora" para carregar status</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
