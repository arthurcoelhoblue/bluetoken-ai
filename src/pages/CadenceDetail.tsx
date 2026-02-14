// ========================================
// PATCH 8.3 - Detalhe da Cadência (Unificado)
// ========================================

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCadence } from '@/hooks/useCadences';
import { supabase } from '@/integrations/supabase/client';
import {
  EMPRESA_LABELS,
  CANAL_LABELS,
  formatOffset,
  getCanalIcon,
} from '@/types/cadence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot,
  GitBranch,
  Clock,
  Users,
  CheckCircle,
  PauseCircle,
  XCircle,
  Edit,
  Briefcase,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

function CadenceDetailContent() {
  const { cadenceId } = useParams<{ cadenceId: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();

  const { cadence, steps, metrics, isLoading, error } = useCadence(cadenceId);
  const isAdmin = roles.includes('ADMIN');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Bot className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !cadence) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-destructive">Cadência não encontrada</p>
        <Button onClick={() => navigate('/cadences')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">{cadence.nome}</h1>
            <p className="text-xs text-muted-foreground">
              <code>{cadence.codigo}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => navigate(`/cadences/${cadence.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          <Badge
            variant={cadence.empresa === 'TOKENIZA' ? 'default' : 'secondary'}
          >
            {EMPRESA_LABELS[cadence.empresa]}
          </Badge>
          <Badge
            className={
              cadence.ativo
                ? 'bg-success text-success-foreground'
                : 'bg-muted text-muted-foreground'
            }
          >
            {cadence.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Canal Principal
                  </p>
                  <p className="font-medium flex items-center gap-2">
                    <span>{getCanalIcon(cadence.canal_principal)}</span>
                    {CANAL_LABELS[cadence.canal_principal]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total de Steps
                  </p>
                  <p className="font-medium">{steps.length}</p>
                </div>
              </div>
              {cadence.descricao && (
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="text-sm">{cadence.descricao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline de Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum step configurado
                </p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-6">
                    {steps.map((step) => (
                      <div key={step.id} className="relative flex gap-4">
                        {/* Step indicator */}
                        <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-card border-2 border-primary text-primary font-bold">
                          {step.ordem}
                        </div>

                        {/* Step content */}
                        <div className="flex-1 bg-muted/50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {getCanalIcon(step.canal)}
                              </span>
                              <span className="font-medium">
                                {CANAL_LABELS[step.canal]}
                              </span>
                            </div>
                            <Badge variant="outline">
                              {formatOffset(step.offset_minutos)}
                            </Badge>
                          </div>

                          <p className="text-sm mb-2">
                            <span className="text-muted-foreground">
                              Template:{' '}
                            </span>
                            <code className="bg-background px-2 py-0.5 rounded text-xs">
                              {step.template_codigo}
                            </code>
                          </p>

                          {step.template_nome && (
                            <p className="text-sm text-muted-foreground">
                              {step.template_nome}
                            </p>
                          )}

                          {step.parar_se_responder && (
                            <div className="mt-2">
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                ⏹️ Para se responder
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Metrics */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Métricas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    {metrics?.total || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total de Runs
                  </p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-success">
                    {metrics?.ativas || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Ativas</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Concluídas
                  </span>
                  <span className="font-medium">
                    {metrics?.concluidas || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm flex items-center gap-2">
                    <PauseCircle className="h-4 w-4 text-warning" />
                    Pausadas
                  </span>
                  <span className="font-medium">
                    {metrics?.pausadas || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Canceladas
                  </span>
                  <span className="font-medium">
                    {metrics?.canceladas || 0}
                  </span>
                </div>
              </div>

              {metrics?.ultimaExecucao && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Última execução
                  </p>
                  <p className="text-sm font-medium">
                    {format(
                      new Date(metrics.ultimaExecucao),
                      "dd/MM/yyyy 'às' HH:mm",
                      { locale: ptBR }
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() =>
                  navigate(`/cadences/runs?cadence_id=${cadence.id}`)
                }
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Ver Execuções
              </Button>
            </CardContent>
          </Card>

          {/* Deals Vinculados */}
          <LinkedDealsCard cadenceId={cadence.id} />
        </div>
      </div>
    </div>
  );
}

// ========================================
// Deals vinculados via deal_cadence_runs
// ========================================

const BRIDGE_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Ativa', className: 'bg-success text-success-foreground' },
  PAUSED: { label: 'Pausada', className: 'bg-warning text-warning-foreground' },
  COMPLETED: { label: 'Concluída', className: 'bg-primary text-primary-foreground' },
  CANCELLED: { label: 'Cancelada', className: 'bg-destructive text-destructive-foreground' },
};

function LinkedDealsCard({ cadenceId }: { cadenceId: string }) {
  const { data: linkedDeals, isLoading } = useQuery({
    queryKey: ['cadence-linked-deals', cadenceId],
    queryFn: async () => {
      // Get all lead_cadence_runs for this cadence
      const { data: runs } = await supabase
        .from('lead_cadence_runs')
        .select('id, status, last_step_ordem, next_step_ordem')
        .eq('cadence_id', cadenceId);

      if (!runs?.length) return [];

      const runIds = runs.map(r => r.id);
      const { data: bridges } = await supabase
        .from('deal_cadence_runs')
        .select('id, deal_id, cadence_run_id, status, trigger_type')
        .in('cadence_run_id', runIds);

      if (!bridges?.length) return [];

      // Get deal names
      const dealIds = [...new Set(bridges.map(b => b.deal_id))];
      const { data: deals } = await supabase
        .from('deals')
        .select('id, titulo')
        .in('id', dealIds);

      const dealMap = new Map(deals?.map(d => [d.id, d.titulo]) ?? []);
      const runMap = new Map(runs.map(r => [r.id, r]));

      // Get total steps
      const { count } = await supabase
        .from('cadence_steps')
        .select('id', { count: 'exact', head: true })
        .eq('cadence_id', cadenceId);

      const totalSteps = count ?? 0;

      return bridges.map(b => {
        const run = runMap.get(b.cadence_run_id);
        return {
          bridgeId: b.id,
          dealId: b.deal_id,
          dealTitulo: dealMap.get(b.deal_id) ?? 'Deal',
          bridgeStatus: b.status,
          triggerType: b.trigger_type,
          lastStep: run?.last_step_ordem ?? 0,
          totalSteps,
        };
      });
    },
  });

  if (isLoading) return <Skeleton className="h-24" />;
  if (!linkedDeals?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Deals Vinculados
          <Badge variant="secondary" className="ml-auto text-xs">{linkedDeals.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {linkedDeals.map(d => {
          const badge = BRIDGE_STATUS_BADGE[d.bridgeStatus] ?? BRIDGE_STATUS_BADGE.ACTIVE;
          const progress = d.totalSteps > 0 ? (d.lastStep / d.totalSteps) * 100 : 0;
          return (
            <div key={d.bridgeId} className="border rounded-md p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{d.dealTitulo}</span>
                <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground">{d.lastStep}/{d.totalSteps}</span>
              </div>
              {d.triggerType !== 'MANUAL' && (
                <p className="text-[10px] text-muted-foreground">
                  Trigger: {d.triggerType === 'STAGE_ENTER' ? 'Entrada' : d.triggerType === 'STAGE_EXIT' ? 'Saída' : d.triggerType}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function CadenceDetail() {
  return (
    <AppLayout>
      <CadenceDetailContent />
    </AppLayout>
  );
}
