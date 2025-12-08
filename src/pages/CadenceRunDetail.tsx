// ========================================
// PATCH 4.4 - Detalhe da Execução (Run)
// ========================================

import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCadenceRunDetail,
  useCadenceEvents,
  useUpdateCadenceRunStatus,
} from '@/hooks/useCadences';
import {
  EMPRESA_LABELS,
  CANAL_LABELS,
  CADENCE_RUN_STATUS_LABELS,
  CADENCE_EVENT_TIPO_LABELS,
  getStatusColor,
  getEventIcon,
  getCanalIcon,
} from '@/types/cadence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Bot,
  GitBranch,
  User,
  Play,
  Pause,
  XCircle,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

function CadenceRunDetailContent() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const { data: run, isLoading, error } = useCadenceRunDetail(runId);
  const { data: events } = useCadenceEvents(runId);
  const updateStatus = useUpdateCadenceRunStatus();

  const canManage = hasRole('ADMIN') || hasRole('CLOSER');

  const handleStatusChange = async (
    newStatus: 'ATIVA' | 'PAUSADA' | 'CANCELADA'
  ) => {
    if (!runId) return;

    try {
      await updateStatus.mutateAsync({ runId, status: newStatus });
      toast.success(
        `Cadência ${
          newStatus === 'ATIVA'
            ? 'retomada'
            : newStatus === 'PAUSADA'
              ? 'pausada'
              : 'cancelada'
        } com sucesso`
      );
    } catch (err) {
      toast.error('Erro ao alterar status da cadência');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Bot className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-destructive">Execução não encontrada</p>
        <Button onClick={() => navigate('/cadences/runs')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Execução de Cadência</h1>
            <p className="text-xs text-muted-foreground">
              {run.cadence_nome}
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(run.status)}>
          {CADENCE_RUN_STATUS_LABELS[run.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg">
                    {run.lead_nome || 'Lead sem nome'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {run.lead_email || run.lead_telefone || run.lead_id}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(`/leads/${run.lead_id}/${run.empresa}`)
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Lead
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline de Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!events?.length ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum evento registrado
                </p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-4">
                    {events.map((event) => (
                      <div key={event.id} className="relative flex gap-4 pl-10">
                        {/* Event indicator */}
                        <div className="absolute left-0 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-card border text-lg">
                          {getEventIcon(event.tipo_evento)}
                        </div>

                        {/* Event content */}
                        <div className="flex-1 bg-muted/50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <Badge
                                variant={
                                  event.tipo_evento === 'DISPARADO'
                                    ? 'default'
                                    : event.tipo_evento === 'ERRO'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {CADENCE_EVENT_TIPO_LABELS[event.tipo_evento]}
                              </Badge>
                              <span className="ml-2 text-sm text-muted-foreground">
                                Step {event.step_ordem}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(
                                new Date(event.created_at),
                                "dd/MM/yyyy 'às' HH:mm:ss",
                                { locale: ptBR }
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            {event.step_canal && (
                              <span className="flex items-center gap-1">
                                <span>{getCanalIcon(event.step_canal)}</span>
                                {CANAL_LABELS[event.step_canal]}
                              </span>
                            )}
                            <span className="text-muted-foreground">•</span>
                            <code className="text-xs bg-background px-2 py-0.5 rounded">
                              {event.template_codigo}
                            </code>
                          </div>

                          {event.detalhes && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">
                                Ver detalhes
                              </summary>
                              <pre className="mt-2 text-xs bg-background p-2 rounded overflow-x-auto">
                                {JSON.stringify(event.detalhes, null, 2)}
                              </pre>
                            </details>
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Run Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <Badge
                  variant={
                    run.empresa === 'TOKENIZA' ? 'default' : 'secondary'
                  }
                >
                  {EMPRESA_LABELS[run.empresa]}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Cadência</p>
                <p className="font-medium">{run.cadence_nome}</p>
                <code className="text-xs text-muted-foreground">
                  {run.cadence_codigo}
                </code>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Progresso</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${(run.last_step_ordem / (run.total_steps || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {run.last_step_ordem}/{run.total_steps || '?'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Iniciado em</p>
                <p className="font-medium">
                  {format(
                    new Date(run.started_at),
                    "dd/MM/yyyy 'às' HH:mm",
                    { locale: ptBR }
                  )}
                </p>
              </div>

              {run.next_run_at && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Próxima ação
                  </p>
                  <p className="font-medium">
                    {format(new Date(run.next_run_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.next_run_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {run.status === 'ATIVA' && (
                  <>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pausar Cadência
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Pausar Cadência?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A cadência será pausada e nenhuma mensagem será
                            enviada até que seja retomada.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleStatusChange('PAUSADA')}
                          >
                            Pausar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Cadência
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Cancelar Cadência?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            A cadência será cancelada permanentemente. Esta
                            ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleStatusChange('CANCELADA')}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancelar Cadência
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {run.status === 'PAUSADA' && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleStatusChange('ATIVA')}
                      disabled={updateStatus.isPending}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Retomar Cadência
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Cadência
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Cancelar Cadência?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            A cadência será cancelada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleStatusChange('CANCELADA')}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancelar Cadência
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {(run.status === 'CONCLUIDA' ||
                  run.status === 'CANCELADA') && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Esta cadência foi{' '}
                    {run.status === 'CONCLUIDA' ? 'concluída' : 'cancelada'}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CadenceRunDetail() {
  return (
    <AppLayout>
      <CadenceRunDetailContent />
    </AppLayout>
  );
}
