import { useParams, useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { useCSCustomerById } from '@/hooks/useCSCustomers';
import { useCSSurveys, useCreateSurvey } from '@/hooks/useCSSurveys';
import { useCSIncidents, useCreateIncident } from '@/hooks/useCSIncidents';
import { useCSHealthLog } from '@/hooks/useCSHealthLog';
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
import { ArrowLeft, HeartPulse, Plus, Send, User, MessageCircle, Briefcase, CalendarClock } from 'lucide-react';
import { healthStatusConfig, gravidadeConfig, incidentStatusConfig, npsConfig } from '@/types/customerSuccess';
import type { CSIncidentTipo, CSGravidade } from '@/types/customerSuccess';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';

export default function CSClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCSCustomerById(id);
  const { data: surveys } = useCSSurveys(id);
  const { data: incidents } = useCSIncidents(id);
  const { data: healthLog } = useCSHealthLog(id);
  const createSurvey = useCreateSurvey();
  const createIncident = useCreateIncident();

  const [npsScore, setNpsScore] = useState('');
  const [incidentForm, setIncidentForm] = useState({ titulo: '', descricao: '', tipo: 'RECLAMACAO' as CSIncidentTipo, gravidade: 'MEDIA' as CSGravidade });
  const [sendingNpsWa, setSendingNpsWa] = useState(false);
  const [deals, setDeals] = useState<any[] | null>(null);
  const [dealsLoading, setDealsLoading] = useState(false);

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
      const { error } = await supabase.functions.invoke('cs-nps-auto', {
        body: { customer_id: customer.id, tipo: 'NPS' },
      });
      if (error) throw error;
      toast.success('NPS enviado via WhatsApp');
    } catch {
      toast.error('Erro ao enviar NPS via WhatsApp');
    } finally {
      setSendingNpsWa(false);
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

  return (
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
                <Badge className={`mt-2 ${healthStatusConfig[customer.health_status]?.bgClass}`}>
                  <HeartPulse className="h-3 w-3 mr-1" />{customer.health_score} — {healthStatusConfig[customer.health_status]?.label}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Métricas</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">MRR</span><span className="font-medium">R$ {customer.valor_mrr?.toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">NPS</span>{customer.nps_categoria ? <Badge className={npsConfig[customer.nps_categoria]?.bgClass}>{customer.ultimo_nps}</Badge> : <span>—</span>}</div>
                <div className="flex justify-between"><span className="text-muted-foreground">CSAT Médio</span><span>{customer.media_csat?.toFixed(1) ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risco Churn</span><span>{customer.risco_churn_pct}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Renovação</span><span>{customer.proxima_renovacao ? format(new Date(customer.proxima_renovacao), 'dd/MM/yy') : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">1º Ganho</span><span>{customer.data_primeiro_ganho ? format(new Date(customer.data_primeiro_ganho), 'dd/MM/yy') : '—'}</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Main */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="pesquisas">
              <TabsList>
                <TabsTrigger value="pesquisas">Pesquisas</TabsTrigger>
                <TabsTrigger value="deals" onClick={loadDeals}>Deals</TabsTrigger>
                <TabsTrigger value="renovacao">Renovação</TabsTrigger>
                <TabsTrigger value="incidencias">Incidências</TabsTrigger>
                <TabsTrigger value="health-log">Health Log</TabsTrigger>
              </TabsList>

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

              <TabsContent value="renovacao" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Renovação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Próxima renovação</span><p className="font-medium">{customer.proxima_renovacao ? format(new Date(customer.proxima_renovacao), 'dd/MM/yyyy') : '—'}</p></div>
                      <div><span className="text-muted-foreground">1º Ganho</span><p className="font-medium">{customer.data_primeiro_ganho ? format(new Date(customer.data_primeiro_ganho), 'dd/MM/yyyy') : '—'}</p></div>
                      <div><span className="text-muted-foreground">MRR</span><p className="font-medium">R$ {customer.valor_mrr?.toLocaleString('pt-BR') ?? '0'}</p></div>
                      <div><span className="text-muted-foreground">Risco Churn</span><p className="font-medium">{customer.risco_churn_pct ?? 0}%</p></div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

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

              <TabsContent value="health-log" className="mt-4 space-y-3">
                {healthLog?.map(log => (
                  <Card key={log.id}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><Badge className={healthStatusConfig[log.status]?.bgClass}>{log.score}</Badge><span className="ml-2 text-sm">{log.motivo_mudanca || 'Recalculado'}</span></div><span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span></div></CardContent></Card>
                ))}
                {healthLog?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro de health score</p>}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
