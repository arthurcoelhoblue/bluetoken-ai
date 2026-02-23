// ========================================
// PATCH 8.3 - Lista Unificada de Cadências
// ========================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCadences, useCadenciasCRMView, useCadenceStageTriggers, useCreateStageTrigger, useDeleteStageTrigger, useToggleCadenceAtivo } from '@/hooks/useCadences';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  EMPRESA_LABELS,
  CANAL_LABELS,
  type CadencesFilters,
  type EmpresaTipo,
} from '@/types/cadence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Eye,
  Filter,
  GitBranch,
  Search,
  X,
  PlusCircle,
  Plus,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePipelines } from '@/hooks/usePipelines';
import { useDealPipelineStages } from '@/hooks/useDealDetail';
import { toast } from 'sonner';

function CadencesListContent() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [filters, setFilters] = useState<CadencesFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const CADENCE_PAGE_SIZE = 25;

  const { data: cadences, isLoading, error } = useCadences(filters);
  const { data: crmStats } = useCadenciasCRMView();
  const toggleAtivo = useToggleCadenceAtivo();

  // Build map of CRM stats by cadence id
  const crmMap = new Map<string, { deals_ativos: number; deals_completados: number }>();
  crmStats?.forEach(c => crmMap.set(c.id, { deals_ativos: c.deals_ativos, deals_completados: c.deals_completados }));

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, searchTerm: searchInput }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchInput('');
    setPage(0);
  };

  const hasActiveFilters =
    filters.empresa !== undefined ||
    filters.ativo !== undefined ||
    filters.searchTerm;

  const isAdmin = roles.includes('ADMIN');

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Cadências</h1>
            <p className="text-xs text-muted-foreground">
              Fluxos de automação SDR & CRM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button onClick={() => navigate('/cadences/new')}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nova Cadência
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="cadencias" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cadencias">Cadências</TabsTrigger>
          <TabsTrigger value="triggers">Triggers CRM</TabsTrigger>
        </TabsList>

        {/* ===== Tab: Cadências ===== */}
        <TabsContent value="cadencias" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou código..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch}>Buscar</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={hasActiveFilters ? 'border-primary' : ''}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Empresa</label>
                    <Select
                      value={filters.empresa || 'all'}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          empresa: v === 'all' ? undefined : (v as EmpresaTipo),
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                        <SelectItem value="BLUE">Blue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select
                      value={filters.ativo === undefined ? 'all' : filters.ativo ? 'ativo' : 'inativo'}
                      onValueChange={(v) =>
                        setFilters((prev) => ({
                          ...prev,
                          ativo: v === 'all' ? undefined : v === 'ativo',
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {hasActiveFilters && (
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={handleClearFilters}>
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
              <CardTitle className="text-lg">
                Cadências Configuradas
                {cadences && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({cadences.length} encontradas)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Bot className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  Erro ao carregar cadências. Tente novamente.
                </div>
              ) : !cadences?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma cadência encontrada.
                </div>
              ) : (() => {
                const totalCount = cadences.length;
                const totalPagesCalc = Math.ceil(totalCount / CADENCE_PAGE_SIZE);
                const paginatedCadences = cadences.slice(page * CADENCE_PAGE_SIZE, (page + 1) * CADENCE_PAGE_SIZE);
                return (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Leads Ativos</TableHead>
                            <TableHead className="text-center">Deals Ativos</TableHead>
                            <TableHead className="text-center">Deals Concluídos</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCadences.map((cadence) => {
                            const crm = crmMap.get(cadence.id);
                            return (
                              <TableRow
                                key={cadence.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => navigate(`/cadences/${cadence.id}`)}
                              >
                                <TableCell className="font-medium">{cadence.nome}</TableCell>
                                <TableCell>
                                  <code className="text-xs bg-muted px-2 py-1 rounded">{cadence.codigo}</code>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={cadence.empresa === 'TOKENIZA' ? 'default' : 'secondary'}>
                                    {EMPRESA_LABELS[cadence.empresa]}
                                  </Badge>
                                </TableCell>
                                <TableCell>{CANAL_LABELS[cadence.canal_principal]}</TableCell>
                                <TableCell className="w-[60px]">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleAtivo.mutate({ id: cadence.id, ativo: !cadence.ativo });
                                    }}
                                  >
                                    <Switch
                                      checked={cadence.ativo}
                                      className="data-[state=checked]:bg-success data-[state=unchecked]:bg-destructive"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {cadence.runs_ativas > 0 ? (
                                    <Badge variant="outline">{cadence.runs_ativas}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {(crm?.deals_ativos ?? 0) > 0 ? (
                                    <Badge variant="outline" className="border-primary text-primary">{crm!.deals_ativos}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {(crm?.deals_completados ?? 0) > 0 ? (
                                    <Badge variant="outline" className="border-success text-success">{crm!.deals_completados}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/cadences/${cadence.id}`);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <DataTablePagination
                      page={page}
                      totalPages={totalPagesCalc}
                      totalCount={totalCount}
                      pageSize={CADENCE_PAGE_SIZE}
                      onPageChange={setPage}
                    />
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Tab: Triggers CRM ===== */}
        <TabsContent value="triggers">
          <TriggersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ========================================
// Triggers Tab (migrated from CadenciasPage)
// ========================================

function TriggersTab() {
  const { data: cadencias } = useCadenciasCRMView();
  const { data: pipelines } = usePipelines();

  const [triggerOpen, setTriggerOpen] = useState(false);
  const [selPipeline, setSelPipeline] = useState('');
  const [selStage, setSelStage] = useState('');
  const [selCadence, setSelCadence] = useState('');
  const [selType, setSelType] = useState('STAGE_ENTER');

  const { data: stages } = useDealPipelineStages(selPipeline || null);
  const createTrigger = useCreateStageTrigger();
  const deleteTrigger = useDeleteStageTrigger();

  const [viewPipeline, setViewPipeline] = useState('');
  const { data: viewTriggers } = useCadenceStageTriggers(viewPipeline || null);
  const { data: viewStages } = useDealPipelineStages(viewPipeline || null);

  const handleCreateTrigger = () => {
    if (!selPipeline || !selStage || !selCadence) {
      toast.error('Preencha todos os campos');
      return;
    }
    createTrigger.mutate(
      { pipeline_id: selPipeline, stage_id: selStage, cadence_id: selCadence, trigger_type: selType },
      {
        onSuccess: () => {
          toast.success('Trigger criado');
          setTriggerOpen(false);
          setSelStage('');
          setSelCadence('');
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao criar trigger'),
      }
    );
  };

  const getStageName = (stageId: string) => viewStages?.find(s => s.id === stageId)?.nome ?? stageId;
  const getCadenceName = (cadenceId: string) => cadencias?.find(c => c.id === cadenceId)?.nome ?? cadenceId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Triggers Automáticos</h2>
          <p className="text-sm text-muted-foreground">Configure cadências para iniciar automaticamente quando um deal muda de estágio.</p>
        </div>
        <Button size="sm" onClick={() => setTriggerOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo Trigger
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Pipeline:</Label>
        <Select value={viewPipeline} onValueChange={setViewPipeline}>
          <SelectTrigger className="w-64 h-8 text-xs">
            <SelectValue placeholder="Selecione um pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nome} ({p.empresa})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {viewPipeline && viewTriggers && viewTriggers.length > 0 ? (
        <div className="space-y-2">
          {viewTriggers.map(t => (
            <div key={t.id} className="flex items-center justify-between border rounded-md p-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  {t.trigger_type === 'STAGE_ENTER' ? '→ Entrada' : '← Saída'}
                </Badge>
                <span className="text-sm">{getStageName(t.stage_id)}</span>
                <span className="text-xs text-muted-foreground">→</span>
                <span className="text-sm font-medium">{getCadenceName(t.cadence_id)}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteTrigger.mutate(t.id, { onSuccess: () => toast.success('Trigger removido') })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : viewPipeline ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum trigger configurado para este pipeline.</p>
      ) : null}

      {/* Create trigger dialog */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Trigger Automático</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pipeline</Label>
              <Select value={selPipeline} onValueChange={v => { setSelPipeline(v); setSelStage(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pipelines?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} ({p.empresa})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estágio</Label>
              <Select value={selStage} onValueChange={setSelStage} disabled={!selPipeline}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {stages?.filter(s => !s.is_won && !s.is_lost).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cadência</Label>
              <Select value={selCadence} onValueChange={setSelCadence}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {cadencias?.filter(c => c.ativo).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={selType} onValueChange={setSelType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAGE_ENTER">Entrada no Estágio</SelectItem>
                  <SelectItem value="STAGE_EXIT">Saída do Estágio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTrigger} disabled={createTrigger.isPending}>Criar Trigger</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CadencesList() {
  return (
    <AppLayout>
      <CadencesListContent />
    </AppLayout>
  );
}
