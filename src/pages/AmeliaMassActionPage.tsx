import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Send, ThumbsUp, ThumbsDown, Search, Zap, FileText, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDeals } from '@/hooks/useDeals';
import { usePipelines } from '@/hooks/usePipelines';
import { useCadences } from '@/hooks/useCadences';
import {
  useMassActionJobs,
  useMassActionJob,
  useCreateMassAction,
  useGenerateMessages,
  useUpdateMessageApproval,
  useExecuteMassAction,
} from '@/hooks/useProjections';
import type { MassActionJobStatus } from '@/types/projection';
import { toast } from '@/hooks/use-toast';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabel: Record<MassActionJobStatus, string> = {
  PENDING: 'Pendente',
  GENERATING: 'Gerando...',
  PREVIEW: 'Preview',
  RUNNING: 'Executando...',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
  PARTIAL: 'Parcial',
};

const statusVariant = (s: MassActionJobStatus) => {
  if (s === 'COMPLETED') return 'default' as const;
  if (s === 'FAILED') return 'destructive' as const;
  if (s === 'RUNNING' || s === 'GENERATING') return 'secondary' as const;
  return 'outline' as const;
};

export default function AmeliaMassActionPage() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const empresa = activeCompany === 'ALL' ? undefined : activeCompany;
  const { data: allPipelines = [] } = usePipelines();
  const firstPipeline = allPipelines[0];
  const { data: deals = [], isLoading: loadingDeals } = useDeals({ pipelineId: firstPipeline?.id || null });
  const pipelines = allPipelines;
  const { data: cadences = [] } = useCadences();
  const { data: jobs = [], isLoading: loadingJobs } = useMassActionJobs(empresa);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterPipeline, setFilterPipeline] = useState('ALL');
  const [showConfig, setShowConfig] = useState(false);
  const [configTab, setConfigTab] = useState<'cadencia' | 'adhoc'>('adhoc');
  const [selectedCadence, setSelectedCadence] = useState('');
  const [instrucao, setInstrucao] = useState('');
  const [canal, setCanal] = useState('WHATSAPP');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const createAction = useCreateMassAction();
  const generateMsgs = useGenerateMessages();
  const updateApproval = useUpdateMessageApproval();
  const executeAction = useExecuteMassAction();
  const { data: activeJob } = useMassActionJob(activeJobId);

  // Filter deals (only ABERTO)
  const filteredDeals = useMemo(() => {
    let d = deals.filter((deal: any) => deal.status === 'ABERTO');
    if (filterPipeline !== 'ALL') d = d.filter((deal: any) => deal.pipeline_id === filterPipeline);
    if (search) {
      const s = search.toLowerCase();
      d = d.filter((deal: any) => deal.titulo?.toLowerCase().includes(s));
    }
    return d;
  }, [deals, filterPipeline, search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredDeals.length) setSelected(new Set());
    else setSelected(new Set(filteredDeals.map((d: any) => d.id)));
  };

  const selectedValue = filteredDeals.filter((d: any) => selected.has(d.id)).reduce((s: number, d: any) => s + (d.valor || 0), 0);

  const handleCreate = async () => {
    if (!user?.id || !empresa) return;
    try {
      const job = await createAction.mutateAsync({
        empresa,
        tipo: configTab === 'cadencia' ? 'CADENCIA_MODELO' : 'CAMPANHA_ADHOC',
        deal_ids: Array.from(selected),
        cadence_id: configTab === 'cadencia' ? selectedCadence : undefined,
        instrucao: configTab === 'adhoc' ? instrucao : undefined,
        canal,
        started_by: user.id,
      });
      setShowConfig(false);
      setActiveJobId(job.id);
      // Trigger AI generation
      generateMsgs.mutate(job.id);
      toast({ title: 'Amélia está gerando mensagens...' });
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleExecute = () => {
    if (!activeJobId) return;
    executeAction.mutate(activeJobId);
    toast({ title: 'Execução iniciada!' });
  };

  // Active job view
  if (activeJob) {
    const isGenerating = activeJob.status === 'GENERATING';
    const isPreview = activeJob.status === 'PREVIEW';
    const isRunning = activeJob.status === 'RUNNING';
    const isDone = ['COMPLETED', 'FAILED', 'PARTIAL'].includes(activeJob.status);
    const previews = activeJob.messages_preview || [];
    const approvedCount = previews.filter(m => m.approved).length;

    return (
      <AppLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Amélia — Ação em Massa</h1>
                <p className="text-sm text-muted-foreground">
                  Job #{activeJob.id.slice(0, 8)} · <Badge variant={statusVariant(activeJob.status as MassActionJobStatus)}>{statusLabel[activeJob.status as MassActionJobStatus]}</Badge>
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setActiveJobId(null)}>Voltar</Button>
          </div>

          {isGenerating && (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <Bot className="h-12 w-12 text-primary mx-auto animate-pulse" />
                <p className="text-lg font-medium">Amélia está gerando mensagens personalizadas...</p>
                <p className="text-sm text-muted-foreground">{activeJob.total} deals selecionados</p>
              </CardContent>
            </Card>
          )}

          {isPreview && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{approvedCount}/{previews.length} mensagens aprovadas</p>
                <Button onClick={handleExecute} disabled={approvedCount === 0}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar {approvedCount} mensagens
                </Button>
              </div>
              <div className="space-y-3">
                {previews.map(m => (
                  <Card key={m.deal_id} className={!m.approved ? 'opacity-50' : ''}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{m.contact_name}</p>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.message}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant={m.approved ? 'default' : 'ghost'}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateApproval.mutate({ jobId: activeJob.id, dealId: m.deal_id, approved: true })}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={!m.approved ? 'destructive' : 'ghost'}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateApproval.mutate({ jobId: activeJob.id, dealId: m.deal_id, approved: false })}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {isRunning && (
            <Card>
              <CardContent className="p-8 space-y-4">
                <p className="text-center font-medium">Enviando mensagens...</p>
                <Progress value={activeJob.total > 0 ? (activeJob.processed / activeJob.total) * 100 : 0} />
                <p className="text-center text-sm text-muted-foreground">
                  {activeJob.processed}/{activeJob.total} processados · {activeJob.succeeded} OK · {activeJob.failed} falhas
                </p>
              </CardContent>
            </Card>
          )}

          {isDone && (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <p className="text-lg font-medium">
                  {activeJob.status === 'COMPLETED' ? '✅ Concluído!' : activeJob.status === 'PARTIAL' ? '⚠️ Parcialmente concluído' : '❌ Falhou'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeJob.succeeded} enviadas · {activeJob.failed} falhas
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Amélia — Ação em Massa</h1>
              <p className="text-sm text-muted-foreground">Selecione deals e acione Amélia para gerar mensagens personalizadas</p>
            </div>
          </div>
          <Button onClick={() => setShowConfig(true)} disabled={selected.size === 0}>
            <Bot className="h-4 w-4 mr-2" />
            Acionar Amélia ({selected.size})
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar deal..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterPipeline} onValueChange={setFilterPipeline}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {pipelines.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Selection summary */}
        {selected.size > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium">{selected.size} deals selecionados</span>
            <span className="text-sm text-muted-foreground">Valor total: {fmt(selectedValue)}</span>
          </div>
        )}

        {/* Deals table */}
        <Card>
          <CardContent className="p-0">
            {loadingDeals ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === filteredDeals.length && filteredDeals.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Temperatura</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.slice(0, 100).map((d: any) => (
                    <TableRow key={d.id} className={selected.has(d.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                      </TableCell>
                      <TableCell className="font-medium truncate max-w-[200px]">{d.titulo}</TableCell>
                      <TableCell className="text-sm">{d.contacts?.nome || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{d.pipeline_stages?.nome || '—'}</Badge></TableCell>
                      <TableCell>
                        {d.temperatura && <Badge variant="secondary" className="text-xs">{d.temperatura}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{d.valor ? fmt(d.valor) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Job history */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingJobs ? (
              <Skeleton className="h-16 w-full" />
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação anterior</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Deals</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(j => (
                    <TableRow key={j.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveJobId(j.id)}>
                      <TableCell className="text-sm">{new Date(j.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{j.tipo === 'CADENCIA_MODELO' ? 'Cadência' : 'Ad-hoc'}</Badge></TableCell>
                      <TableCell className="text-sm">{j.canal}</TableCell>
                      <TableCell className="text-sm">{j.total}</TableCell>
                      <TableCell className="text-sm">{j.succeeded}/{j.total}</TableCell>
                      <TableCell><Badge variant={statusVariant(j.status as MassActionJobStatus)}>{statusLabel[j.status as MassActionJobStatus]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Config dialog */}
        <Dialog open={showConfig} onOpenChange={setShowConfig}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurar Ação em Massa</DialogTitle>
            </DialogHeader>
            <Tabs value={configTab} onValueChange={v => setConfigTab(v as 'cadencia' | 'adhoc')}>
              <TabsList className="w-full">
                <TabsTrigger value="cadencia" className="flex-1"><Zap className="h-4 w-4 mr-1" /> Cadência Modelo</TabsTrigger>
                <TabsTrigger value="adhoc" className="flex-1"><FileText className="h-4 w-4 mr-1" /> Campanha Ad-hoc</TabsTrigger>
              </TabsList>
              <TabsContent value="cadencia" className="space-y-3 mt-3">
                <Select value={selectedCadence} onValueChange={setSelectedCadence}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar cadência..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cadences.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="adhoc" className="space-y-3 mt-3">
                <Textarea
                  placeholder="Instrução para a Amélia (ex: 'Oferecer desconto de 10% para fechamento esta semana')..."
                  value={instrucao}
                  onChange={e => setInstrucao(e.target.value)}
                  rows={4}
                />
              </TabsContent>
            </Tabs>
            <div className="mt-3">
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowConfig(false)}>Cancelar</Button>
              <Button
                onClick={handleCreate}
                disabled={createAction.isPending || (configTab === 'cadencia' && !selectedCadence) || (configTab === 'adhoc' && !instrucao.trim())}
              >
                <Bot className="h-4 w-4 mr-2" />
                Gerar Mensagens
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
