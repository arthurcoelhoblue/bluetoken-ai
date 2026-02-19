import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { useCSCustomerById } from '@/hooks/useCSCustomers';
import { useCSSurveys, useCreateSurvey } from '@/hooks/useCSSurveys';
import { useCSIncidents, useCreateIncident } from '@/hooks/useCSIncidents';
import { useCSHealthLog } from '@/hooks/useCSHealthLog';
import { useCSContracts } from '@/hooks/useCSContracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, HeartPulse, Plus, Send, User, MessageCircle, Briefcase, CalendarClock, Clock, Phone, Mail, AlertTriangle, FileText, StickyNote, Bot, ScrollText } from 'lucide-react';
import { healthStatusConfig, gravidadeConfig, incidentStatusConfig, npsConfig, contractStatusConfig } from '@/types/customerSuccess';
import type { CSIncidentTipo, CSGravidade } from '@/types/customerSuccess';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';
import { ClickToCallButton } from '@/components/zadarma/ClickToCallButton';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';
import { CSContractForm } from '@/components/cs/CSContractForm';
import { CSRenovacaoTab } from '@/components/cs/CSRenovacaoTab';
import { CSAportesTab } from '@/components/cs/CSAportesTab';
import { useCSTokenizaMetrics } from '@/hooks/useCSTokenizaMetrics';

// Icons for timeline items
const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  deal_activity: <Briefcase className="h-3 w-3" />,
  survey: <MessageCircle className="h-3 w-3" />,
  incident: <AlertTriangle className="h-3 w-3" />,
  health: <HeartPulse className="h-3 w-3" />,
};

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  date: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function DetailSidebarMetrics({ customer }: { customer: any }) {
  const isTokeniza = customer.empresa === 'TOKENIZA';
  const { data: metricsMap } = useCSTokenizaMetrics(isTokeniza ? [customer.id] : undefined);
  const tm = isTokeniza ? metricsMap?.get(customer.id) : null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Métricas</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isTokeniza ? (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Investido</span><span className="font-medium">R$ {(tm?.total_investido ?? 0).toLocaleString('pt-BR')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ticket Médio</span><span className="font-medium">R$ {(tm?.ticket_medio ?? 0).toLocaleString('pt-BR')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Investimentos</span><span>{tm?.qtd_investimentos ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">1º Investimento</span><span>{customer.data_primeiro_ganho ? format(new Date(customer.data_primeiro_ganho), 'dd/MM/yy') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Último Aporte</span><span>{tm?.ultimo_investimento ? format(new Date(tm.ultimo_investimento), 'dd/MM/yy') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dias s/ Investir</span><span>{tm?.dias_sem_investir ?? '—'}</span></div>
          </>
        ) : (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">MRR</span><span className="font-medium">R$ {customer.valor_mrr?.toLocaleString('pt-BR')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Renovação</span><span>{customer.proxima_renovacao ? format(new Date(customer.proxima_renovacao), 'dd/MM/yy') : '—'}</span></div>
          </>
        )}
        <div className="flex justify-between"><span className="text-muted-foreground">NPS</span>{customer.nps_categoria ? <Badge className={npsConfig[customer.nps_categoria]?.bgClass}>{customer.ultimo_nps}</Badge> : <span>—</span>}</div>
        <div className="flex justify-between"><span className="text-muted-foreground">CSAT Médio</span><span>{customer.media_csat?.toFixed(1) ?? '—'}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Risco Churn</span><span>{customer.risco_churn_pct}%</span></div>
        {!isTokeniza && <div className="flex justify-between"><span className="text-muted-foreground">1º Ganho</span><span>{customer.data_primeiro_ganho ? format(new Date(customer.data_primeiro_ganho), 'dd/MM/yy') : '—'}</span></div>}
      </CardContent>
    </Card>
  );
}

export default function CSClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCSCustomerById(id);
  const { data: surveys } = useCSSurveys(id);
  const { data: incidents } = useCSIncidents(id);
  const { data: healthLog } = useCSHealthLog(id);
  const { data: contracts } = useCSContracts(id);
  const createSurvey = useCreateSurvey();
  const createIncident = useCreateIncident();

  const [npsScore, setNpsScore] = useState('');
  const [incidentForm, setIncidentForm] = useState({ titulo: '', descricao: '', tipo: 'RECLAMACAO' as CSIncidentTipo, gravidade: 'MEDIA' as CSGravidade });
  const [sendingNpsWa, setSendingNpsWa] = useState(false);
  const [deals, setDeals] = useState<any[] | null>(null);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [csmNote, setCsmNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [suggestingNote, setSuggestingNote] = useState(false);
  const { trackPageView } = useAnalyticsEvents();

  useEffect(() => {
    trackPageView('cs_cliente_detail');
  }, [trackPageView]);

  // Load CSM notes from customer
  useEffect(() => {
    if (customer?.notas_csm) setCsmNote(customer.notas_csm);
  }, [customer?.notas_csm]);

  const loadDeals = async () => {
    if (deals || !customer?.contact_id) return;
    setDealsLoading(true);
    const { data } = await supabase.from('deals').select('id, titulo, valor, status, created_at, pipeline_stages:stage_id(nome, cor)').eq('contact_id', customer.contact_id).order('created_at', { ascending: false }).limit(50);
    setDeals(data ?? []);
    setDealsLoading(false);
  };

  const handleSendNpsWhatsApp = async () => {
    if (!customer) return;
    setSendingNpsWa(true);
    try {
      const { error } = await supabase.functions.invoke('cs-scheduled-jobs', {
        body: { action: 'nps-auto', customer_id: customer.id, tipo: 'NPS' },
      });
      if (error) throw error;
      toast.success('NPS enviado via WhatsApp');
    } catch {
      toast.error('Erro ao enviar NPS via WhatsApp');
    } finally {
      setSendingNpsWa(false);
    }
  };

  const handleSaveNote = async () => {
    if (!customer) return;
    setSavingNote(true);
    try {
      const { error } = await supabase.from('cs_customers').update({ notas_csm: csmNote }).eq('id', customer.id);
      if (error) throw error;
      toast.success('Notas salvas');
    } catch {
      toast.error('Erro ao salvar notas');
    } finally {
      setSavingNote(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!customer) return <div className="p-6"><p>Cliente não encontrado</p></div>;

  const handleSendNps = async () => {
    if (!npsScore) return;
    try {
      await createSurvey.mutateAsync({ customer_id: customer.id, empresa: customer.empresa, tipo: 'NPS', pergunta: 'Em uma escala de 0 a 10, o quanto você recomendaria nossa empresa?', nota: parseInt(npsScore) });
      toast.success('NPS registrado');
      setNpsScore('');
    } catch { toast.error('Erro ao registrar NPS'); }
  };

  const handleCreateIncident = async () => {
    if (!incidentForm.titulo) return;
    try {
      await createIncident.mutateAsync({ customer_id: customer.id, empresa: customer.empresa, ...incidentForm });
      toast.success('Incidência criada');
      setIncidentForm({ titulo: '', descricao: '', tipo: 'RECLAMACAO', gravidade: 'MEDIA' });
    } catch { toast.error('Erro ao criar incidência'); }
  };

  // Build unified timeline
  const timelineItems: TimelineItem[] = [];
  surveys?.forEach(s => {
    timelineItems.push({
      id: `survey-${s.id}`, type: 'survey',
      title: `${s.tipo} — Nota: ${s.nota ?? 'Pendente'}`,
      description: s.pergunta || undefined,
      date: s.enviado_em,
      badge: s.tipo, badgeVariant: 'outline',
    });
  });
  incidents?.forEach(inc => {
    timelineItems.push({
      id: `incident-${inc.id}`, type: 'incident',
      title: inc.titulo,
      description: inc.descricao?.slice(0, 100) || undefined,
      date: inc.created_at,
      badge: gravidadeConfig[inc.gravidade]?.label,
      badgeVariant: inc.gravidade === 'CRITICA' || inc.gravidade === 'ALTA' ? 'destructive' : 'secondary',
    });
  });
  healthLog?.forEach(log => {
    timelineItems.push({
      id: `health-${log.id}`, type: 'health',
      title: `Health Score: ${log.score}`,
      description: log.motivo_mudanca || 'Recalculado',
      date: log.created_at,
      badge: healthStatusConfig[log.status]?.label,
      badgeVariant: log.status === 'CRITICO' || log.status === 'EM_RISCO' ? 'destructive' : 'default',
    });
  });
  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <AppLayout>
    <div className="flex-1 overflow-auto">
      <PageShell icon={User} title={customer.contact?.nome || 'Cliente CS'} description="Detalhe do cliente" />

      <div className="px-6 pb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/cs/clientes')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Avatar className="h-16 w-16 mx-auto mb-3">
                  <AvatarImage src={customer.contact?.foto_url || undefined} />
                  <AvatarFallback className="text-lg">{customer.contact?.nome?.charAt(0)}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold">{customer.contact?.nome}</h3>
                <p className="text-sm text-muted-foreground">{customer.contact?.email}</p>
                {customer.contact?.telefone && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="text-sm text-muted-foreground">{customer.contact.telefone}</span>
                    <ClickToCallButton phone={customer.contact.telefone} contactName={customer.contact.nome} customerId={customer.id} />
                  </div>
                )}
                <Badge className={`mt-2 ${healthStatusConfig[customer.health_status]?.bgClass}`}>
                  <HeartPulse className="h-3 w-3 mr-1" />{customer.health_score} — {healthStatusConfig[customer.health_status]?.label}
                </Badge>
              </CardContent>
            </Card>
            <DetailSidebarMetrics customer={customer} />
          </div>

          {/* Main */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="visao-geral">
              <TabsList className="grid grid-cols-8 w-full">
                <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
                <TabsTrigger value="contratos">{customer.empresa === 'TOKENIZA' ? 'Investimentos' : 'Contratos'}</TabsTrigger>
                <TabsTrigger value="pesquisas">Pesquisas</TabsTrigger>
                <TabsTrigger value="deals" onClick={loadDeals}>Deals</TabsTrigger>
                <TabsTrigger value="renovacao">{customer.empresa === 'TOKENIZA' ? 'Aportes' : 'Renovação'}</TabsTrigger>
                <TabsTrigger value="incidencias">Incidências</TabsTrigger>
                <TabsTrigger value="health-log">Health</TabsTrigger>
                <TabsTrigger value="notas">Notas</TabsTrigger>
              </TabsList>

              {/* Visão Geral — Unified Timeline */}
              <TabsContent value="visao-geral" className="mt-4 space-y-3">
                {timelineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado ainda.</p>
                ) : (
                  timelineItems.slice(0, 30).map(item => (
                    <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        {TIMELINE_ICONS[item.type] || <Clock className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.title}</span>
                          {item.badge && <Badge variant={item.badgeVariant || 'outline'} className="text-[10px] px-1.5 py-0">{item.badge}</Badge>}
                        </div>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        <span className="text-[10px] text-muted-foreground">{format(new Date(item.date), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Contratos / Investimentos */}
              <TabsContent value="contratos" className="mt-4 space-y-4">
                {customer.empresa !== 'TOKENIZA' && (
                  <CSContractForm customerId={customer.id} empresa={customer.empresa} />
                )}
                {contracts?.length === 0 && <p className="text-sm text-muted-foreground">{customer.empresa === 'TOKENIZA' ? 'Nenhum investimento registrado' : 'Nenhum contrato registrado'}</p>}
                {contracts?.map(ct => (
                  <Card key={ct.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center font-bold text-sm">
                            {ct.ano_fiscal}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{ct.oferta_nome || ct.plano || 'Sem plano'}</p>
                            {ct.tipo && <Badge variant="outline" className="text-[10px] mt-0.5">{ct.tipo}</Badge>}
                            <p className="text-xs text-muted-foreground">
                              {ct.data_contratacao ? format(new Date(ct.data_contratacao), 'dd/MM/yyyy') : '—'}
                              {ct.data_vencimento ? ` → ${format(new Date(ct.data_vencimento), 'dd/MM/yyyy')}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm">R$ {ct.valor?.toLocaleString('pt-BR') ?? '0'}</span>
                          <Badge className={contractStatusConfig[ct.status as keyof typeof contractStatusConfig]?.bgClass || ''}>
                            {contractStatusConfig[ct.status as keyof typeof contractStatusConfig]?.label || ct.status}
                          </Badge>
                        </div>
                      </div>
                      {ct.notas && <p className="text-xs text-muted-foreground mt-2">{ct.notas}</p>}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Pesquisas */}
              <TabsContent value="pesquisas" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Registrar NPS</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-end gap-3">
                      <div className="flex-1"><Label>Nota (0-10)</Label><Input type="number" min={0} max={10} value={npsScore} onChange={e => setNpsScore(e.target.value)} placeholder="0-10" /></div>
                      <Button onClick={handleSendNps} disabled={createSurvey.isPending}><Send className="h-4 w-4 mr-1" /> Registrar</Button>
                    </div>
                    <div className="border-t pt-3">
                      <Button variant="outline" onClick={handleSendNpsWhatsApp} disabled={sendingNpsWa}>
                        <MessageCircle className="h-4 w-4 mr-1" /> Enviar NPS via WhatsApp
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">Envia pesquisa NPS automatizada ao cliente pelo WhatsApp</p>
                    </div>
                  </CardContent>
                </Card>
                {surveys?.map(s => (
                  <Card key={s.id}><CardContent className="pt-4 flex items-center justify-between"><div><Badge variant="outline">{s.tipo}</Badge><span className="ml-2 text-sm">{s.pergunta || 'Pesquisa'}</span><p className="text-xs text-muted-foreground mt-1">{format(new Date(s.enviado_em), "dd/MM/yy HH:mm", { locale: ptBR })}</p></div><div className="text-right">{s.nota != null ? <span className="text-2xl font-bold">{s.nota}</span> : <Badge variant="secondary">Pendente</Badge>}</div></CardContent></Card>
                ))}
                {surveys?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pesquisa registrada</p>}
              </TabsContent>

              {/* Deals */}
              <TabsContent value="deals" className="mt-4 space-y-3">
                {dealsLoading && <LoadingSpinner />}
                {deals?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum deal associado a este contato</p>}
                {deals?.map(d => (
                  <Card key={d.id}>
                    <CardContent className="pt-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Briefcase className="h-3 w-3" />{d.titulo}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {d.created_at ? format(new Date(d.created_at), "dd/MM/yy", { locale: ptBR }) : ''} · {d.pipeline_stages?.nome || '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">R$ {d.valor?.toLocaleString('pt-BR') ?? '0'}</p>
                        <Badge variant="outline" className="capitalize">{d.status?.toLowerCase()}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Renovação / Aportes */}
              <TabsContent value="renovacao" className="mt-4">
                {customer.empresa === 'TOKENIZA' ? (
                  <CSAportesTab customerId={customer.id} empresa={customer.empresa} />
                ) : (
                  <CSRenovacaoTab
                    customerId={customer.id}
                    contactId={customer.contact_id}
                    empresa={customer.empresa}
                    dataPrimeiroGanho={customer.data_primeiro_ganho}
                    proximaRenovacao={customer.proxima_renovacao}
                    riscoChurnPct={customer.risco_churn_pct}
                  />
                )}
              </TabsContent>

              {/* Incidências */}
              <TabsContent value="incidencias" className="mt-4 space-y-4">
                <Dialog>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Incidência</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova Incidência</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Título</Label><Input value={incidentForm.titulo} onChange={e => setIncidentForm(f => ({ ...f, titulo: e.target.value }))} /></div>
                      <div><Label>Descrição</Label><Textarea value={incidentForm.descricao} onChange={e => setIncidentForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Tipo</Label><Select value={incidentForm.tipo} onValueChange={v => setIncidentForm(f => ({ ...f, tipo: v as CSIncidentTipo }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RECLAMACAO">Reclamação</SelectItem><SelectItem value="ATRASO">Atraso</SelectItem><SelectItem value="ERRO_OPERACIONAL">Erro Operacional</SelectItem><SelectItem value="FALHA_COMUNICACAO">Falha Comunicação</SelectItem><SelectItem value="INSATISFACAO">Insatisfação</SelectItem><SelectItem value="SOLICITACAO">Solicitação</SelectItem><SelectItem value="OUTRO">Outro</SelectItem></SelectContent></Select></div>
                        <div><Label>Gravidade</Label><Select value={incidentForm.gravidade} onValueChange={v => setIncidentForm(f => ({ ...f, gravidade: v as CSGravidade }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BAIXA">Baixa</SelectItem><SelectItem value="MEDIA">Média</SelectItem><SelectItem value="ALTA">Alta</SelectItem><SelectItem value="CRITICA">Crítica</SelectItem></SelectContent></Select></div>
                      </div>
                      <Button onClick={handleCreateIncident} disabled={createIncident.isPending} className="w-full">Criar Incidência</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                {incidents?.map(inc => (
                  <Card key={inc.id}><CardContent className="pt-4 flex items-center justify-between"><div><p className="font-medium text-sm">{inc.titulo}</p><p className="text-xs text-muted-foreground mt-1">{inc.descricao?.slice(0, 100)}</p><p className="text-xs text-muted-foreground mt-1">{format(new Date(inc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</p></div><div className="flex gap-2"><Badge className={gravidadeConfig[inc.gravidade]?.bgClass}>{gravidadeConfig[inc.gravidade]?.label}</Badge><Badge className={incidentStatusConfig[inc.status]?.bgClass}>{incidentStatusConfig[inc.status]?.label}</Badge></div></CardContent></Card>
                ))}
                {incidents?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma incidência</p>}
              </TabsContent>

              {/* Health Log */}
              <TabsContent value="health-log" className="mt-4 space-y-3">
                {healthLog?.map(log => (
                  <Card key={log.id}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><Badge className={healthStatusConfig[log.status]?.bgClass}>{log.score}</Badge><span className="ml-2 text-sm">{log.motivo_mudanca || 'Recalculado'}</span></div><span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span></div></CardContent></Card>
                ))}
                {healthLog?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro de health score</p>}
              </TabsContent>

              {/* Notas CSM */}
              <TabsContent value="notas" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StickyNote className="h-4 w-4" /> Notas do CSM
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={csmNote}
                      onChange={e => setCsmNote(e.target.value)}
                      placeholder="Adicione observações, contexto e notas sobre este cliente..."
                      className="min-h-[200px]"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveNote} disabled={savingNote} size="sm">
                        <FileText className="h-4 w-4 mr-1" /> Salvar Notas
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={suggestingNote}
                        onClick={async () => {
                          setSuggestingNote(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('cs-ai-actions', {
                              body: { action: 'suggest-note', customer_id: customer.id },
                            });
                            if (error) throw error;
                            if (data?.sugestao) {
                              setCsmNote(prev => prev ? `${prev}\n\n--- Sugestão Amélia ---\n${data.sugestao}` : data.sugestao);
                              toast.success('Sugestão gerada pela Amélia');
                            }
                          } catch {
                            toast.error('Erro ao gerar sugestão');
                          } finally {
                            setSuggestingNote(false);
                          }
                        }}
                      >
                        <Bot className="h-4 w-4 mr-1" /> {suggestingNote ? 'Gerando...' : 'Sugerir Nota (Amélia)'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
