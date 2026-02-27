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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bot, Send, ThumbsUp, ThumbsDown, Search, FileText, History, SlidersHorizontal, X, ChevronDown, ShieldCheck, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePipelines } from '@/hooks/usePipelines';
import {
  useMassActionJobs,
  useMassActionJob,
  useCreateMassAction,
  useGenerateMessages,
  useUpdateMessageApproval,
  useExecuteMassAction,
  usePendingApprovalJobs,
  useAllPendingApprovalJobs,
  useApproveJob,
  useRejectJob,
} from '@/hooks/useProjections';
import type { MassActionJobStatus, MassActionJob } from '@/types/projection';
import { toast } from '@/hooks/use-toast';
import { subDays, isAfter } from 'date-fns';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabel: Record<MassActionJobStatus, string> = {
  PENDING: 'Pendente',
  GENERATING: 'Gerando...',
  PREVIEW: 'Preview',
  RUNNING: 'Executando...',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
  PARTIAL: 'Parcial',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  REJECTED: 'Rejeitado',
};

const statusVariant = (s: MassActionJobStatus) => {
  if (s === 'COMPLETED') return 'default' as const;
  if (s === 'FAILED' || s === 'REJECTED') return 'destructive' as const;
  if (s === 'RUNNING' || s === 'GENERATING') return 'secondary' as const;
  if (s === 'AGUARDANDO_APROVACAO') return 'outline' as const;
  return 'outline' as const;
};

interface DealWithRelations {
  id: string;
  titulo: string;
  valor: number | null;
  temperatura: string | null;
  status: string;
  stage_id: string | null;
  pipeline_id: string | null;
  owner_id: string | null;
  contact_id: string | null;
  score_probabilidade: number | null;
  origem: string | null;
  tags: string[] | null;
  created_at: string;
  contacts: { id: string; nome: string; email: string | null; telefone: string | null } | null;
  pipeline_stages: { id: string; nome: string; cor: string | null; is_won: boolean; is_lost: boolean } | null;
  owner: { id: string; nome: string | null; email: string; avatar_url: string | null } | null;
}

interface PipelineItem {
  id: string;
  nome: string;
}

interface TemplateItem {
  id: string;
  nome: string;
  codigo: string;
  canal: string;
  conteudo: string;
}

/** Fetch all open deals for a given empresa (across all pipelines) */
function useAllOpenDeals(empresa: string | undefined) {
  return useQuery({
    queryKey: ['mass-action-deals', empresa],
    enabled: !!empresa,
    queryFn: async () => {
      let query = supabase
        .from('deals')
        .select(`
          *,
          contacts:contact_id(id, nome, email, telefone),
          pipeline_stages:stage_id(id, nome, cor, is_won, is_lost),
          owner:owner_id(id, nome, email, avatar_url)
        `)
        .eq('status', 'ABERTO');

      if (empresa) {
        const { data: pipIds } = await supabase
          .from('pipelines')
          .select('id')
          .eq('empresa', empresa as 'BLUE' | 'TOKENIZA')
          .eq('ativo', true);
        if (pipIds && pipIds.length > 0) {
          query = query.in('pipeline_id', pipIds.map(p => p.id));
        } else {
          return [];
        }
      }

      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as DealWithRelations[];
    },
  });
}

/** Fetch active templates for the empresa */
function useTemplates(empresa: string | undefined, canal: string) {
  return useQuery({
    queryKey: ['templates-mass-action', empresa, canal],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('id, nome, codigo, canal, conteudo')
        .eq('empresa', empresa as 'BLUE' | 'TOKENIZA')
        .eq('ativo', true)
        .eq('canal', canal as 'WHATSAPP' | 'EMAIL' | 'SMS')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as TemplateItem[];
    },
  });
}

/** Fetch profile to get gestor_id */
function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-profile-gestor', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, gestor_id')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data as { id: string; gestor_id: string | null };
    },
  });
}

/** Check if user is a gestor (has subordinates) */
function useIsGestor(userId: string | undefined) {
  return useQuery({
    queryKey: ['is-gestor', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('gestor_id', userId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

/** Fetch started_by user name */
function useProfileName(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-name', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('id', userId!)
        .single();
      return data?.nome || data?.email || 'Usuário';
    },
  });
}

export default function AmeliaMassActionPage() {
  const { user, hasRole } = useAuth();
  const { activeCompany } = useCompany();
  const empresa = activeCompany;
  const { data: allPipelines = [] } = usePipelines();
  const { data: deals = [], isLoading: loadingDeals } = useAllOpenDeals(empresa);
  const pipelines = allPipelines;
  const { data: jobs = [], isLoading: loadingJobs } = useMassActionJobs(empresa);
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: isGestor } = useIsGestor(user?.id);
  const isAdmin = hasRole('ADMIN');
  const canApprove = isAdmin || !!isGestor;

  // Pending approval jobs
  const { data: myPendingJobs = [] } = usePendingApprovalJobs(user?.id, empresa);
  const { data: allPendingJobs = [] } = useAllPendingApprovalJobs(empresa);
  const pendingJobs = isAdmin ? allPendingJobs : myPendingJobs;

  const approveJob = useApproveJob();
  const rejectJob = useRejectJob();

  // ─── Filter state ───
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterPipeline, setFilterPipeline] = useState('ALL');
  const [filterStage, setFilterStage] = useState('ALL');
  const [filterTemperatura, setFilterTemperatura] = useState('ALL');
  const [filterOwner, setFilterOwner] = useState('ALL');
  const [filterTag, setFilterTag] = useState('ALL');
  const [filterOrigem, setFilterOrigem] = useState('ALL');
  const [filterValorMin, setFilterValorMin] = useState('');
  const [filterValorMax, setFilterValorMax] = useState('');
  const [filterPeriodo, setFilterPeriodo] = useState('ALL');
  const [filterScore, setFilterScore] = useState('ALL');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // ─── Config dialog state ───
  const [showConfig, setShowConfig] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [instrucao, setInstrucao] = useState('');
  const [canal, setCanal] = useState('WHATSAPP');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // ─── Reject dialog state ───
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: templates = [] } = useTemplates(empresa, canal);

  const createAction = useCreateMassAction();
  const generateMsgs = useGenerateMessages();
  const updateApproval = useUpdateMessageApproval();
  const executeAction = useExecuteMassAction();
  const { data: activeJob } = useMassActionJob(activeJobId);

  // ─── Extract dynamic filter options from deals ───
  const filterOptions = useMemo(() => {
    const stages = new Map<string, string>();
    const owners = new Map<string, string>();
    const tags = new Set<string>();
    const origens = new Set<string>();

    for (const d of deals) {
      if (d.pipeline_stages?.id) stages.set(d.pipeline_stages.id, d.pipeline_stages.nome);
      if (d.owner?.id) owners.set(d.owner.id, d.owner.nome || d.owner.email);
      if (d.tags && Array.isArray(d.tags)) d.tags.forEach((t: string) => tags.add(t));
      if (d.origem) origens.add(d.origem);
    }

    const filteredStages = filterPipeline === 'ALL'
      ? Array.from(stages.entries())
      : deals
          .filter((d) => d.pipeline_id === filterPipeline)
          .reduce((acc: Map<string, string>, d) => {
            if (d.pipeline_stages?.id) acc.set(d.pipeline_stages.id, d.pipeline_stages.nome);
            return acc;
          }, new Map<string, string>())
          .entries();

    return {
      stages: Array.from(filteredStages),
      owners: Array.from(owners.entries()),
      tags: Array.from(tags).sort(),
      origens: Array.from(origens).sort(),
    };
  }, [deals, filterPipeline]);

  // ─── Count active filters ───
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStage !== 'ALL') count++;
    if (filterTemperatura !== 'ALL') count++;
    if (filterOwner !== 'ALL') count++;
    if (filterTag !== 'ALL') count++;
    if (filterOrigem !== 'ALL') count++;
    if (filterValorMin) count++;
    if (filterValorMax) count++;
    if (filterPeriodo !== 'ALL') count++;
    if (filterScore !== 'ALL') count++;
    return count;
  }, [filterStage, filterTemperatura, filterOwner, filterTag, filterOrigem, filterValorMin, filterValorMax, filterPeriodo, filterScore]);

  const clearAllFilters = () => {
    setSearch('');
    setFilterPipeline('ALL');
    setFilterStage('ALL');
    setFilterTemperatura('ALL');
    setFilterOwner('ALL');
    setFilterTag('ALL');
    setFilterOrigem('ALL');
    setFilterValorMin('');
    setFilterValorMax('');
    setFilterPeriodo('ALL');
    setFilterScore('ALL');
  };

  // ─── Filtering logic ───
  const filteredDeals = useMemo(() => {
    let d = deals;
    if (filterPipeline !== 'ALL') d = d.filter((deal) => deal.pipeline_id === filterPipeline);
    if (filterStage !== 'ALL') d = d.filter((deal) => deal.stage_id === filterStage);
    if (filterTemperatura !== 'ALL') d = d.filter((deal) => deal.temperatura === filterTemperatura);
    if (filterOwner !== 'ALL') d = d.filter((deal) => deal.owner_id === filterOwner);
    if (filterTag !== 'ALL') d = d.filter((deal) => deal.tags && Array.isArray(deal.tags) && deal.tags.includes(filterTag));
    if (filterOrigem !== 'ALL') d = d.filter((deal) => deal.origem === filterOrigem);
    if (filterValorMin) {
      const min = parseFloat(filterValorMin);
      if (!isNaN(min)) d = d.filter((deal) => (deal.valor ?? 0) >= min);
    }
    if (filterValorMax) {
      const max = parseFloat(filterValorMax);
      if (!isNaN(max)) d = d.filter((deal) => (deal.valor ?? 0) <= max);
    }
    if (filterPeriodo !== 'ALL') {
      const daysMap: Record<string, number> = { '1D': 1, '7D': 7, '30D': 30, '90D': 90 };
      const days = daysMap[filterPeriodo];
      if (days) {
        const cutoff = subDays(new Date(), days);
        d = d.filter((deal) => isAfter(new Date(deal.created_at), cutoff));
      }
    }
    if (filterScore !== 'ALL') {
      if (filterScore === 'HIGH') d = d.filter((deal) => (deal.score_probabilidade ?? 0) >= 70);
      else if (filterScore === 'MED') d = d.filter((deal) => (deal.score_probabilidade ?? 0) >= 40 && (deal.score_probabilidade ?? 0) < 70);
      else if (filterScore === 'LOW') d = d.filter((deal) => (deal.score_probabilidade ?? 0) < 40);
    }
    if (search) {
      const s = search.toLowerCase();
      d = d.filter((deal) =>
        deal.titulo?.toLowerCase().includes(s) ||
        deal.contacts?.nome?.toLowerCase().includes(s) ||
        deal.contacts?.email?.toLowerCase().includes(s)
      );
    }
    return d;
  }, [deals, filterPipeline, filterStage, filterTemperatura, filterOwner, filterTag, filterOrigem, filterValorMin, filterValorMax, filterPeriodo, filterScore, search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredDeals.length) setSelected(new Set());
    else setSelected(new Set(filteredDeals.map((d) => d.id)));
  };

  const selectedValue = filteredDeals.filter((d) => selected.has(d.id)).reduce((s: number, d) => s + (d.valor || 0), 0);

  const handleCreate = async () => {
    if (!user?.id || !empresa) return;
    const needsApproval = !canApprove;

    try {
      const job = await createAction.mutateAsync({
        empresa,
        tipo: 'CADENCIA_MODELO',
        deal_ids: Array.from(selected),
        template_id: selectedTemplate || undefined,
        instrucao: instrucao.trim() || undefined,
        canal,
        started_by: user.id,
        needs_approval: needsApproval,
      });

      setShowConfig(false);

      if (needsApproval) {
        // Send notification to gestor
        if (userProfile?.gestor_id) {
          await supabase.from('notifications').insert({
            user_id: userProfile.gestor_id,
            empresa: empresa as 'BLUE' | 'TOKENIZA',
            titulo: '⏳ Ação em Massa aguardando aprovação',
            mensagem: `${user.email} criou uma ação em massa com ${job.total} deals aguardando sua aprovação.`,
            tipo: 'APROVACAO',
            referencia_tipo: 'MASS_ACTION',
            referencia_id: job.id,
            link: '/amelia/mass-action',
          });
        }
        toast({ title: 'Ação criada', description: 'Aguardando aprovação do gestor.' });
      } else {
        setActiveJobId(job.id);
        generateMsgs.mutate(job.id);
        toast({ title: 'Amélia está gerando mensagens...' });
      }
    } catch (e: unknown) {
      toast({ title: 'Erro', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleApprove = async (jobId: string) => {
    if (!user?.id) return;
    try {
      await approveJob.mutateAsync({ jobId, approvedBy: user.id });
      // After approval, generate messages
      generateMsgs.mutate(jobId);
      toast({ title: 'Ação aprovada!', description: 'Gerando mensagens...' });
    } catch (e: unknown) {
      toast({ title: 'Erro ao aprovar', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!user?.id || !rejectingJobId) return;
    try {
      await rejectJob.mutateAsync({ jobId: rejectingJobId, rejectedBy: user.id, reason: rejectReason });
      setRejectDialogOpen(false);
      setRejectingJobId(null);
      setRejectReason('');
      toast({ title: 'Ação rejeitada' });
    } catch (e: unknown) {
      toast({ title: 'Erro ao rejeitar', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleExecute = () => {
    if (!activeJobId) return;
    executeAction.mutate(activeJobId);
    toast({ title: 'Execução iniciada!' });
  };

  // ─── Active job view ───
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

        {/* ─── Pending Approval Panel (visible to admins/gestores) ─── */}
        {canApprove && pendingJobs.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                Pendências de Aprovação ({pendingJobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Deals</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingJobs.map(j => (
                    <PendingApprovalRow
                      key={j.id}
                      job={j}
                      onApprove={() => handleApprove(j.id)}
                      onReject={() => {
                        setRejectingJobId(j.id);
                        setRejectDialogOpen(true);
                      }}
                      isApproving={approveJob.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ─── Filters ─── */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar deal ou contato..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterPipeline} onValueChange={v => { setFilterPipeline(v); setFilterStage('ALL'); }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Pipeline" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos Pipelines</SelectItem>
                  {pipelines.map((p: PipelineItem) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStage} onValueChange={setFilterStage}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estágio" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos Estágios</SelectItem>
                  {filterOptions.stages.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTemperatura} onValueChange={setFilterTemperatura}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Temperatura" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="QUENTE">🔥 Quente</SelectItem>
                  <SelectItem value="MORNO">🌤 Morno</SelectItem>
                  <SelectItem value="FRIO">❄️ Frio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Collapsible open={showMoreFilters} onOpenChange={setShowMoreFilters}>
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {showMoreFilters ? 'Menos filtros' : 'Mais filtros'}
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">{activeFilterCount}</Badge>
                    )}
                    <ChevronDown className={`h-3 w-3 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                {(activeFilterCount > 0 || search || filterPipeline !== 'ALL') && (
                  <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1" onClick={clearAllFilters}>
                    <X className="h-3 w-3" /> Limpar filtros
                  </Button>
                )}
              </div>
              <CollapsibleContent className="pt-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={filterOwner} onValueChange={setFilterOwner}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos Vendedores</SelectItem>
                      {filterOptions.owners.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterTag} onValueChange={setFilterTag}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tag" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas Tags</SelectItem>
                      {filterOptions.tags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas Origens</SelectItem>
                      {filterOptions.origens.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Período" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todo período</SelectItem>
                      <SelectItem value="1D">Hoje</SelectItem>
                      <SelectItem value="7D">Últimos 7 dias</SelectItem>
                      <SelectItem value="30D">Últimos 30 dias</SelectItem>
                      <SelectItem value="90D">Últimos 90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterScore} onValueChange={setFilterScore}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Score" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos Scores</SelectItem>
                      <SelectItem value="HIGH">Alto (≥70)</SelectItem>
                      <SelectItem value="MED">Médio (40-69)</SelectItem>
                      <SelectItem value="LOW">Baixo (&lt;40)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" placeholder="Valor mín" className="w-[110px]" value={filterValorMin} onChange={e => setFilterValorMin(e.target.value)} />
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input type="number" placeholder="Valor máx" className="w-[110px]" value={filterValorMax} onChange={e => setFilterValorMax(e.target.value)} />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Selection summary */}
        {selected.size > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium">{selected.size} deals selecionados</span>
            <span className="text-sm text-muted-foreground">Valor total: {fmt(selectedValue)}</span>
          </div>
        )}

        {/* Deals table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {filteredDeals.length} deals encontrados
              {filteredDeals.length > 100 && <span className="text-xs text-muted-foreground font-normal ml-2">(mostrando 100 primeiros)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingDeals ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selected.size === filteredDeals.length && filteredDeals.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Temperatura</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhum deal encontrado com os filtros selecionados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeals.slice(0, 100).map((d) => (
                      <TableRow key={d.id} className={selected.has(d.id) ? 'bg-primary/5' : ''}>
                        <TableCell><Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} /></TableCell>
                        <TableCell className="font-medium truncate max-w-[200px]">{d.titulo}</TableCell>
                        <TableCell className="text-sm">{d.contacts?.nome || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{d.pipeline_stages?.nome || '—'}</Badge></TableCell>
                        <TableCell>{d.temperatura && <Badge variant="secondary" className="text-xs">{d.temperatura}</Badge>}</TableCell>
                        <TableCell className="text-sm truncate max-w-[120px]">{d.owner?.nome || d.owner?.email || '—'}</TableCell>
                        <TableCell className="text-sm">{d.origem || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap max-w-[150px]">
                            {d.tags && Array.isArray(d.tags) ? d.tags.slice(0, 2).map((t: string) => (
                              <Badge key={t} variant="outline" className="text-[10px] px-1">{t}</Badge>
                            )) : '—'}
                            {d.tags && d.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{d.tags.length - 2}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{d.valor ? fmt(d.valor) : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
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
                      <TableCell><Badge variant={statusVariant(j.status as MassActionJobStatus)}>{statusLabel[j.status as MassActionJobStatus] || j.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Config dialog — template obrigatório */}
        <Dialog open={showConfig} onOpenChange={setShowConfig}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurar Ação em Massa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Canal selector */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Canal</label>
                <Select value={canal} onValueChange={v => { setCanal(v); setSelectedTemplate(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template selector (obrigatório) */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Template de Mensagem <span className="text-destructive">*</span>
                </label>
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
                    Nenhum template ativo encontrado para {canal === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'}. Cadastre um template antes de criar ações em massa.
                  </p>
                ) : (
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            {t.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Instrução complementar (opcional) */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Instrução complementar (opcional)</label>
                <Textarea
                  placeholder="Ex: 'Mencionar promoção de fim de ano'..."
                  value={instrucao}
                  onChange={e => setInstrucao(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Approval notice */}
              {!canApprove && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Esta ação precisará da aprovação do seu gestor antes de ser executada.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowConfig(false)}>Cancelar</Button>
              <Button
                onClick={handleCreate}
                disabled={createAction.isPending || !selectedTemplate}
              >
                <Bot className="h-4 w-4 mr-2" />
                {canApprove ? 'Gerar Mensagens' : 'Solicitar Aprovação'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rejeitar Ação em Massa</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <label className="text-sm font-medium">Motivo da rejeição</label>
              <Textarea
                placeholder="Descreva o motivo da rejeição..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || rejectJob.isPending}>
                <XCircle className="h-4 w-4 mr-2" />
                Rejeitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

/** Row component for pending approval — fetches the creator's name */
function PendingApprovalRow({ job, onApprove, onReject, isApproving }: { job: MassActionJob; onApprove: () => void; onReject: () => void; isApproving: boolean }) {
  const { data: creatorName } = useProfileName(job.started_by);
  return (
    <TableRow>
      <TableCell className="text-sm">{new Date(job.created_at).toLocaleDateString('pt-BR')}</TableCell>
      <TableCell className="text-sm">{creatorName || '...'}</TableCell>
      <TableCell className="text-sm">{job.canal}</TableCell>
      <TableCell className="text-sm">{job.total}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={onApprove} disabled={isApproving}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Aprovar
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={onReject}>
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Rejeitar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
