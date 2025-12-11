import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useLeadsWithClassification,
  LeadsClassificationFilters,
} from '@/hooks/useLeadClassification';
import { useLeadsWithPendingActions } from '@/hooks/useLeadsWithPendingActions';
import {
  ICP_LABELS,
  PERSONA_LABELS,
  TEMPERATURA_LABELS,
  PRIORIDADE_LABELS,
  TEMPERATURAS,
  PRIORIDADES,
  ICPS_TOKENIZA,
  ICPS_BLUE,
} from '@/types/classification';
import { ACAO_LABELS, type SdrAcaoTipo } from '@/types/intent';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { Temperatura, ICP, Prioridade } from '@/types/classification';
import type { EmpresaTipo } from '@/types/sgt';

function TemperatureBadge({ temperatura }: { temperatura: Temperatura }) {
  const colorMap: Record<Temperatura, string> = {
    QUENTE: 'bg-destructive text-destructive-foreground',
    MORNO: 'bg-warning text-warning-foreground',
    FRIO: 'bg-primary text-primary-foreground',
  };

  return (
    <Badge className={colorMap[temperatura]}>
      {TEMPERATURA_LABELS[temperatura]}
    </Badge>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const colorMap: Record<Prioridade, string> = {
    1: 'bg-destructive text-destructive-foreground',
    2: 'bg-warning text-warning-foreground',
    3: 'bg-muted text-muted-foreground',
  };

  return (
    <Badge variant="outline" className={colorMap[prioridade]}>
      P{prioridade} - {PRIORIDADE_LABELS[prioridade]}
    </Badge>
  );
}

function LeadsListContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Ação pendente do dashboard
  const acaoPendente = searchParams.get('acao_pendente') as SdrAcaoTipo | null;
  
  const [filters, setFilters] = useState<LeadsClassificationFilters>({});
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Query normal de leads
  const { data, isLoading, error } = useLeadsWithClassification({
    filters,
    page,
    pageSize: 15,
  });

  // Query de leads com ação pendente
  const { 
    data: pendingLeads, 
    isLoading: isPendingLoading 
  } = useLeadsWithPendingActions(acaoPendente);

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, searchTerm: searchInput }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchInput('');
    setPage(1);
    // Limpar também o filtro de ação pendente
    if (acaoPendente) {
      setSearchParams({});
    }
  };

  const handleClearActionFilter = () => {
    setSearchParams({});
  };

  const hasActiveFilters =
    filters.empresa ||
    filters.temperatura ||
    filters.icp ||
    filters.prioridade ||
    filters.searchTerm ||
    acaoPendente;

  const allIcps = [...ICPS_TOKENIZA, ...ICPS_BLUE];

  // Se tem filtro de ação pendente, mostrar lista específica
  const showPendingView = !!acaoPendente;
  const acaoLabel = acaoPendente ? ACAO_LABELS[acaoPendente] || acaoPendente : '';

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Leads</h1>
            <p className="text-xs text-muted-foreground">
              {showPendingView ? `Ação pendente: ${acaoLabel}` : 'Gestão e priorização'}
            </p>
          </div>
        </div>
        {!showPendingView && (
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
        )}
      </div>

      {/* Banner de Ação Pendente */}
      {showPendingView && (
        <Alert className="mb-6 border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>Filtro ativo: {acaoLabel}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Mostrando {pendingLeads?.length || 0} leads com esta ação pendente.
            </span>
            <Button variant="outline" size="sm" onClick={handleClearActionFilter}>
              <X className="h-4 w-4 mr-1" />
              Limpar filtro
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          {/* Search */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou ID do lead..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Buscar</Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
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
                  Temperatura
                </label>
                <Select
                  value={filters.temperatura || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      temperatura:
                        v === 'all' ? undefined : (v as Temperatura),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {TEMPERATURAS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TEMPERATURA_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">ICP</label>
                <Select
                  value={filters.icp || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      icp: v === 'all' ? undefined : (v as ICP),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {allIcps.map((icp) => (
                      <SelectItem key={icp} value={icp}>
                        {ICP_LABELS[icp]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Prioridade
                </label>
                <Select
                  value={filters.prioridade?.toString() || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      prioridade:
                        v === 'all' ? undefined : (Number(v) as Prioridade),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p} value={p.toString()}>
                        P{p} - {PRIORIDADE_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <div className="col-span-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {showPendingView ? 'Leads com Ação Pendente' : 'Leads'}
              {!showPendingView && data && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({data.totalCount} encontrados)
                </span>
              )}
              {showPendingView && pendingLeads && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({pendingLeads.length} encontrados)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(showPendingView ? isPendingLoading : isLoading) ? (
            <div className="flex items-center justify-center py-12">
              <Bot className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Erro ao carregar leads. Tente novamente.
            </div>
          ) : showPendingView && (!pendingLeads || pendingLeads.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead com esta ação pendente.
            </div>
          ) : !showPendingView && !data?.data.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead encontrado com os filtros aplicados.
            </div>
          ) : showPendingView ? (
            // Tabela de leads com ação pendente
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Resumo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLeads?.map((lead) => (
                    <TableRow
                      key={`${lead.lead_id}-${lead.message_id}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/leads/${lead.lead_id}/${lead.empresa}`)}
                    >
                      <TableCell className="font-medium">
                        {lead.nome || lead.primeiro_nome || 'Sem nome'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lead.email && (
                            <div className="text-muted-foreground">{lead.email}</div>
                          )}
                          {lead.telefone && (
                            <div className="text-muted-foreground">{lead.telefone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lead.empresa === 'TOKENIZA' ? 'default' : 'secondary'}>
                          {lead.empresa}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.intent}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {lead.intent_summary || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leads/${lead.lead_id}/${lead.empresa}`);
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
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>ICP</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Temperatura</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((lead) => (
                      <TableRow
                        key={`${lead.lead_id}-${lead.empresa}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          navigate(`/leads/${lead.lead_id}/${lead.empresa}`)
                        }
                      >
                        <TableCell className="font-medium">
                          {lead.nome || lead.primeiro_nome || 'Sem nome'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {lead.email && (
                              <div className="text-muted-foreground">
                                {lead.email}
                              </div>
                            )}
                            {lead.telefone && (
                              <div className="text-muted-foreground">
                                {lead.telefone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              lead.empresa === 'TOKENIZA'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {lead.empresa}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lead.classification?.icp ? (
                            <span className="text-sm">
                              {ICP_LABELS[lead.classification.icp]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.classification?.persona ? (
                            <span className="text-sm">
                              {PERSONA_LABELS[lead.classification.persona]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.classification?.temperatura ? (
                            <TemperatureBadge
                              temperatura={lead.classification.temperatura}
                            />
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.classification?.prioridade ? (
                            <PrioridadeBadge
                              prioridade={lead.classification.prioridade}
                            />
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
                              navigate(
                                `/leads/${lead.lead_id}/${lead.empresa}`
                              );
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

export default function LeadsList() {
  return (
    <AppLayout>
      <LeadsListContent />
    </AppLayout>
  );
}
