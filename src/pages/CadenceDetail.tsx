// ========================================
// PATCH 4.2 - Detalhe da Cadência
// ========================================

import { useParams, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useCadence } from '@/hooks/useCadences';
import {
  EMPRESA_LABELS,
  CANAL_LABELS,
  formatOffset,
  getCanalIcon,
} from '@/types/cadence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ChevronLeft,
  GitBranch,
  Clock,
  Users,
  CheckCircle,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function CadenceDetailContent() {
  const { cadenceId } = useParams<{ cadenceId: string }>();
  const navigate = useNavigate();

  const { cadence, steps, metrics, isLoading, error } = useCadence(cadenceId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Bot className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !cadence) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">Cadência não encontrada</p>
        <Button onClick={() => navigate('/cadences')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/cadences')}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
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
      </header>

      <main className="container mx-auto px-4 py-6">
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
                      {steps.map((step, index) => (
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
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CadenceDetail() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MARKETING', 'CLOSER']}>
      <CadenceDetailContent />
    </ProtectedRoute>
  );
}
