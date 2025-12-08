// ========================================
// PATCH 4.3 - Lista de Execuções (Runs)
// ========================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCadenceRuns, useCadences } from '@/hooks/useCadences';
import {
  EMPRESA_LABELS,
  CADENCE_RUN_STATUS_LABELS,
  getStatusColor,
  type CadenceRunsFilters,
  type EmpresaTipo,
  type CadenceRunStatus,
} from '@/types/cadence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  GitBranch,
  X,
  User,
  Search,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function CadenceRunsListContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const initialCadenceId = searchParams.get('cadence_id') || undefined;
  
  const [filters, setFilters] = useState<CadenceRunsFilters>({
    cadence_id: initialCadenceId,
  });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading, error } = useCadenceRuns(filters, {
    page,
    pageSize: 20,
  });
  const { data: cadences } = useCadences();

  const handleClearFilters = () => {
    setFilters({});
    setSearchInput('');
    setPage(1);
  };

  const hasActiveFilters =
    filters.empresa || filters.cadence_id || filters.status;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Leads em Cadência</h1>
            <p className="text-xs text-muted-foreground">
              Execuções ativas e histórico
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

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou ID do lead..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setPage(1)}>Buscar</Button>
          </div>
        </CardContent>
      </Card>

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
                  onValueChange={(v) => {
                    setFilters((prev) => ({
                      ...prev,
                      empresa: v === 'all' ? undefined : (v as EmpresaTipo),
                    }));
                    setPage(1);
                  }}
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
                  Cadência
                </label>
                <Select
                  value={filters.cadence_id || 'all'}
                  onValueChange={(v) => {
                    setFilters((prev) => ({
                      ...prev,
                      cadence_id: v === 'all' ? undefined : v,
                    }));
                    setPage(1);
                  }}
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

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Status
                </label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(v) => {
                    setFilters((prev) => ({
                      ...prev,
                      status:
                        v === 'all' ? undefined : (v as CadenceRunStatus),
                    }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ATIVA">Ativa</SelectItem>
                    <SelectItem value="PAUSADA">Pausada</SelectItem>
                    <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Execuções
              {data && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({data.totalCount} encontradas)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Bot className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Erro ao carregar execuções. Tente novamente.
            </div>
          ) : !data?.data.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma execução encontrada.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Cadência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Próxima Ação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data
                      .filter((run) => {
                        if (!searchInput) return true;
                        const search = searchInput.toLowerCase();
                        return (
                          run.lead_nome?.toLowerCase().includes(search) ||
                          run.lead_email?.toLowerCase().includes(search) ||
                          run.lead_id.toLowerCase().includes(search)
                        );
                      })
                      .map((run) => (
                        <TableRow
                          key={run.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/cadences/runs/${run.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {run.lead_nome || 'Lead sem nome'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {run.lead_email || run.lead_id}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                run.empresa === 'TOKENIZA'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {EMPRESA_LABELS[run.empresa]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">
                                {run.cadence_nome}
                              </p>
                              <code className="text-xs text-muted-foreground">
                                {run.cadence_codigo}
                              </code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(run.status)}>
                              {CADENCE_RUN_STATUS_LABELS[run.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-16">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{
                                    width: `${(run.last_step_ordem / (run.total_steps || 1)) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {run.last_step_ordem}/{run.total_steps || '?'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {run.next_run_at ? (
                              <div>
                                <p className="text-sm">
                                  {format(
                                    new Date(run.next_run_at),
                                    'dd/MM HH:mm'
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(run.next_run_at),
                                    {
                                      addSuffix: true,
                                      locale: ptBR,
                                    }
                                  )}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                -
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/cadences/runs/${run.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Página {data.page} de {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CadenceRunsList() {
  return (
    <AppLayout>
      <CadenceRunsListContent />
    </AppLayout>
  );
}
