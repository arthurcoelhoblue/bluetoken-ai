// ========================================
// PATCH 4.6 - Próximas Ações de Cadências
// ========================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCadenceNextActions, useCadences } from '@/hooks/useCadences';
import {
  EMPRESA_LABELS,
  CANAL_LABELS,
  getCanalIcon,
  type CadenceNextActionsFilters,
  type EmpresaTipo,
  type CanalTipo,
} from '@/types/cadence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bot,
  Calendar,
  Clock,
  Filter,
  X,
  User,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isBefore, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function CadenceNextActionsContent() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CadenceNextActionsFilters>({
    periodo: 'hoje',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: actions, isLoading, error } = useCadenceNextActions(filters);
  const { data: cadences } = useCadences();

  const handleClearFilters = () => {
    setFilters({ periodo: 'hoje' });
  };

  const hasActiveFilters =
    filters.empresa || filters.canal || filters.cadence_id;

  // Contadores
  const atrasadas = actions?.filter((a) => isPast(new Date(a.next_run_at))).length || 0;
  const proximas2h =
    actions?.filter((a) => {
      const actionDate = new Date(a.next_run_at);
      return !isPast(actionDate) && isBefore(actionDate, addHours(new Date(), 2));
    }).length || 0;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
            <Calendar className="h-6 w-6 text-success" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Próximas Ações</h1>
            <p className="text-xs text-muted-foreground">
              Agenda de cadências automáticas
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? 'border-primary' : ''}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              Ativos
            </Badge>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{actions?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">
                  {atrasadas}
                </p>
                <p className="text-xs text-muted-foreground">Atrasadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{proximas2h}</p>
                <p className="text-xs text-muted-foreground">Próximas 2h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <Select
              value={filters.periodo || 'hoje'}
              onValueChange={(v) =>
                setFilters((prev) => ({
                  ...prev,
                  periodo: v as CadenceNextActionsFilters['periodo'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="24h">Próximas 24h</SelectItem>
                <SelectItem value="3dias">Próximos 3 dias</SelectItem>
                <SelectItem value="semana">Próxima semana</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Empresa
                </label>
                <Select
                  value={filters.empresa || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      empresa: v === 'all' ? undefined : (v as EmpresaTipo),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                    <SelectItem value="BLUE">Blue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Canal
                </label>
                <Select
                  value={filters.canal || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      canal: v === 'all' ? undefined : (v as CanalTipo),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Cadência
                </label>
                <Select
                  value={filters.cadence_id || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      cadence_id: v === 'all' ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {cadences?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações Agendadas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Bot className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Erro ao carregar ações. Tente novamente.
            </div>
          ) : !actions?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma ação agendada para o período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cadência</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => {
                    const actionDate = new Date(action.next_run_at);
                    const isAtrasada = isPast(actionDate);
                    const isProxima2h =
                      !isAtrasada && isBefore(actionDate, addHours(new Date(), 2));

                    return (
                      <TableRow
                        key={action.run_id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          isAtrasada ? 'bg-destructive/5' : ''
                        } ${isProxima2h ? 'bg-warning/5' : ''}`}
                        onClick={() =>
                          navigate(`/cadences/runs/${action.run_id}`)
                        }
                      >
                        <TableCell>
                          <div
                            className={
                              isAtrasada ? 'text-destructive' : ''
                            }
                          >
                            <p className="font-medium">
                              {format(actionDate, 'dd/MM HH:mm')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(actionDate, {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {action.lead_nome || 'Sem nome'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {action.lead_email || action.lead_id}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              action.empresa === 'TOKENIZA'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {EMPRESA_LABELS[action.empresa]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{action.cadence_nome}</p>
                            <code className="text-xs text-muted-foreground">
                              {action.cadence_codigo}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <span>{getCanalIcon(action.canal)}</span>
                            {CANAL_LABELS[action.canal]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            Step {action.next_step_ordem}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAtrasada ? (
                            <Badge className="bg-destructive text-destructive-foreground">
                              Atrasada
                            </Badge>
                          ) : isProxima2h ? (
                            <Badge className="bg-warning text-warning-foreground">
                              Em breve
                            </Badge>
                          ) : (
                            <Badge variant="outline">Agendada</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CadenceNextActions() {
  return (
    <AppLayout>
      <CadenceNextActionsContent />
    </AppLayout>
  );
}
