import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarCheck, Clock, AlertTriangle, Trophy, XCircle,
  CheckSquare, TrendingUp, DollarSign, Flame,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToggleTaskActivity } from '@/hooks/useDealDetail';
import {
  useWorkbenchTarefas,
  useWorkbenchSLAAlerts,
  useWorkbenchPipelineSummary,
  useWorkbenchRecentDeals,
} from '@/hooks/useWorkbench';
import { DealDetailSheet } from '@/components/deals/DealDetailSheet';
import { toast } from 'sonner';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getTaskUrgency(prazo: string | null): 'overdue' | 'today' | 'upcoming' | 'no-date' {
  if (!prazo) return 'no-date';
  const now = new Date();
  const d = new Date(prazo);
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'overdue';
  if (diff < 86_400_000) return 'today';
  return 'upcoming';
}

export default function WorkbenchPage() {
  const { profile } = useAuth();
  const { data: tarefas, isLoading: loadingTarefas } = useWorkbenchTarefas();
  const { data: slaAlerts, isLoading: loadingSLA } = useWorkbenchSLAAlerts();
  const { data: pipelines, isLoading: loadingPipelines } = useWorkbenchPipelineSummary();
  const { data: recentDeals, isLoading: loadingRecent } = useWorkbenchRecentDeals();
  const toggleTask = useToggleTaskActivity();

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const slaEstourados = slaAlerts?.filter(a => a.sla_estourado) ?? [];
  const tarefasHoje = tarefas?.filter(t => {
    const u = getTaskUrgency(t.tarefa_prazo);
    return u === 'today' || u === 'overdue';
  }) ?? [];

  const totalAberto = pipelines?.reduce((s, p) => s + (p.valor_aberto ?? 0), 0) ?? 0;
  const totalGanho = pipelines?.reduce((s, p) => s + (p.valor_ganho ?? 0), 0) ?? 0;
  const totalDealsAbertos = pipelines?.reduce((s, p) => s + (p.deals_abertos ?? 0), 0) ?? 0;

  const hoje = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  const handleToggleTask = (taskId: string, dealId: string) => {
    toggleTask.mutate({ id: taskId, concluida: true, dealId }, {
      onSuccess: () => toast.success('Tarefa concluída!'),
    });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-0">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            {getGreeting()}, {profile?.nome?.split(' ')[0] ?? 'Usuário'}
          </h2>
          <p className="text-sm text-muted-foreground capitalize">{hoje}</p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            {tarefasHoje.length > 0 && (
              <span className="flex items-center gap-1 text-warning">
                <CheckSquare className="h-4 w-4" />
                {tarefasHoje.length} tarefa{tarefasHoje.length > 1 ? 's' : ''} hoje
              </span>
            )}
            {slaEstourados.length > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {slaEstourados.length} SLA estourado{slaEstourados.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Pipeline Aberto"
            value={formatBRL(totalAberto)}
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            loading={loadingPipelines}
          />
          <KPICard
            title="Total Ganho"
            value={formatBRL(totalGanho)}
            icon={<DollarSign className="h-4 w-4 text-success" />}
            loading={loadingPipelines}
          />
          <KPICard
            title="Deals Abertos"
            value={String(totalDealsAbertos)}
            icon={<Flame className="h-4 w-4 text-warning" />}
            loading={loadingPipelines}
          />
          <KPICard
            title="SLA Estourados"
            value={String(slaEstourados.length)}
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            loading={loadingSLA}
            variant={slaEstourados.length > 0 ? 'destructive' : 'default'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SLA Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas de SLA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSLA ? (
                <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : slaAlerts && slaAlerts.length > 0 ? (
                slaAlerts.slice(0, 8).map(alert => (
                  <button
                    key={alert.deal_id}
                    onClick={() => setSelectedDealId(alert.deal_id)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{alert.deal_titulo}</span>
                      <Badge
                        variant={alert.sla_estourado ? 'destructive' : 'secondary'}
                        className="text-[10px] shrink-0"
                      >
                        {alert.sla_estourado ? 'ESTOURADO' : `${alert.sla_percentual}%`}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{alert.contact_nome}</span>
                      <span>·</span>
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: alert.stage_cor, color: alert.stage_cor }}>
                        {alert.stage_nome}
                      </Badge>
                    </div>
                    <Progress
                      value={Math.min(alert.sla_percentual, 100)}
                      className={`h-1.5 ${alert.sla_estourado ? '[&>div]:bg-destructive' : ''}`}
                    />
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta de SLA</p>
              )}
            </CardContent>
          </Card>

          {/* Tarefas Pendentes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                Tarefas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingTarefas ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : tarefas && tarefas.length > 0 ? (
                tarefas.slice(0, 10).map(t => {
                  const urgency = getTaskUrgency(t.tarefa_prazo);
                  return (
                    <div key={t.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <Checkbox
                        className="mt-1"
                        onCheckedChange={() => handleToggleTask(t.id, t.deal_id)}
                      />
                      <button
                        onClick={() => setSelectedDealId(t.deal_id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm truncate">{t.descricao || 'Tarefa sem descrição'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate">{t.deal_titulo}</span>
                          {t.tarefa_prazo && (
                            <>
                              <span>·</span>
                              <span className={
                                urgency === 'overdue' ? 'text-destructive font-medium' :
                                urgency === 'today' ? 'text-warning font-medium' : ''
                              }>
                                <Clock className="h-3 w-3 inline mr-0.5" />
                                {urgency === 'overdue' ? 'Atrasada' :
                                 urgency === 'today' ? 'Hoje' :
                                 format(new Date(t.tarefa_prazo), 'dd/MM', { locale: ptBR })}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa pendente 🎉</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Meus Pipelines */}
        <div className="mt-6">
          <h3 className="text-base font-semibold mb-3">Meus Pipelines</h3>
          {loadingPipelines ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : pipelines && pipelines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pipelines.map(p => (
                <Card key={p.pipeline_id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{p.pipeline_nome}</span>
                      <Badge variant="secondary" className="text-[10px]">{p.pipeline_empresa}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{p.deals_abertos}</p>
                        <p className="text-[10px] text-muted-foreground">Abertos</p>
                        <p className="text-xs font-medium text-primary">{formatBRL(p.valor_aberto)}</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-success">{p.deals_ganhos}</p>
                        <p className="text-[10px] text-muted-foreground">Ganhos</p>
                        <p className="text-xs font-medium text-success">{formatBRL(p.valor_ganho)}</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-destructive">{p.deals_perdidos}</p>
                        <p className="text-[10px] text-muted-foreground">Perdidos</p>
                        <p className="text-xs font-medium text-destructive">{formatBRL(p.valor_perdido)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum pipeline encontrado</p>
          )}
        </div>

        {/* Deals Recentes */}
        <div className="mt-6">
          <h3 className="text-base font-semibold mb-3">Deals Recentes (7 dias)</h3>
          {loadingRecent ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : recentDeals && recentDeals.length > 0 ? (
            <div className="space-y-1">
              {recentDeals.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDealId(d.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  {d.status === 'GANHO' && <Trophy className="h-4 w-4 text-success shrink-0" />}
                  {d.status === 'PERDIDO' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  {d.status === 'ABERTO' && (
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: d.stage_cor }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.contact_nome} · {d.pipeline_nome}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">{formatBRL(d.valor ?? 0)}</p>
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: d.stage_cor, color: d.stage_cor }}>
                      {d.stage_nome}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum deal nos últimos 7 dias</p>
          )}
        </div>

        {/* Deal Detail Sheet */}
        <DealDetailSheet
          dealId={selectedDealId}
          open={!!selectedDealId}
          onOpenChange={open => !open && setSelectedDealId(null)}
        />
      </div>
    </AppLayout>
  );
}

function KPICard({
  title, value, icon, loading, variant = 'default',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  loading: boolean;
  variant?: 'default' | 'destructive';
}) {
  return (
    <Card className={variant === 'destructive' && value !== '0' ? 'border-destructive/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{title}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className={`text-xl font-bold ${variant === 'destructive' && value !== '0' ? 'text-destructive' : ''}`}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
