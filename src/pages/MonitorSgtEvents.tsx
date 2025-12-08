import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search, Eye, Calendar, Building2, Zap, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

import { useSgtEvents, useSgtEventDetails, type SGTEventsFilters, type SGTEventWithLogs } from '@/hooks/useSgtEvents';
import { Constants } from '@/integrations/supabase/types';

const EVENTOS = Constants.public.Enums.sgt_evento_tipo;
const STATUS_OPTIONS = Constants.public.Enums.sgt_event_status;

function getStatusFromLogs(logs: SGTEventWithLogs['sgt_event_logs']): string {
  if (!logs || logs.length === 0) return 'RECEBIDO';
  const sorted = [...logs].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted[0].status;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PROCESSADO':
      return (
        <Badge className="bg-success/10 text-success border-success/20 gap-1">
          <CheckCircle className="h-3 w-3" />
          Processado
        </Badge>
      );
    case 'ERRO':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Erro
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Recebido
        </Badge>
      );
  }
}

function EmpresaBadge({ empresa }: { empresa: string }) {
  if (empresa === 'TOKENIZA') {
    return (
      <Badge className="bg-accent/10 text-accent border-accent/20">
        Tokeniza
      </Badge>
    );
  }
  return (
    <Badge className="bg-primary/10 text-primary border-primary/20">
      Blue
    </Badge>
  );
}

function EventoLabel({ evento }: { evento: string }) {
  const labels: Record<string, string> = {
    'LEAD_NOVO': 'Lead Novo',
    'ATUALIZACAO': 'Atualização',
    'CARRINHO_ABANDONADO': 'Carrinho Abandonado',
    'MQL': 'MQL',
    'SCORE_ATUALIZADO': 'Score Atualizado',
    'CLIQUE_OFERTA': 'Clique Oferta',
    'FUNIL_ATUALIZADO': 'Funil Atualizado',
  };
  return <span>{labels[evento] || evento}</span>;
}

export default function MonitorSgtEvents() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [filters, setFilters] = useState<SGTEventsFilters>({});
  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  
  const { data, isLoading, error, refetch, isFetching } = useSgtEvents({
    filters: {
      ...filters,
      dataInicial: dataInicial ? new Date(dataInicial) : null,
      dataFinal: dataFinal ? new Date(dataFinal) : null,
    },
    page,
    pageSize: 15,
  });
  
  const { data: eventDetails, isLoading: isLoadingDetails } = useSgtEventDetails(selectedEventId);

  const handleFilterChange = (key: keyof SGTEventsFilters, value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? null : value,
    }));
    setPage(1);
  };

  const handleDateFilter = () => {
    setFilters(prev => ({
      ...prev,
      dataInicial: dataInicial ? new Date(dataInicial) : null,
      dataFinal: dataFinal ? new Date(dataFinal) : null,
    }));
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: 'Atualizado',
      description: 'Lista de eventos atualizada.',
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Erro ao carregar eventos
              </CardTitle>
              <CardDescription>
                Não foi possível buscar os eventos do SGT. Verifique suas permissões.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => refetch()} variant="outline">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Eventos SGT</h1>
                <p className="text-sm text-muted-foreground">
                  Monitoramento de eventos recebidos do Sistema de Gestão de Tráfego
                </p>
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Select
                  value={filters.empresa || 'all'}
                  onValueChange={(value) => handleFilterChange('empresa', value)}
                >
                  <SelectTrigger id="empresa">
                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                    <SelectItem value="BLUE">Blue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evento">Tipo de Evento</Label>
                <Select
                  value={filters.evento || 'all'}
                  onValueChange={(value) => handleFilterChange('evento', value)}
                >
                  <SelectTrigger id="evento">
                    <Zap className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {EVENTOS.map((evento) => (
                      <SelectItem key={evento} value={evento}>
                        <EventoLabel evento={evento} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataInicial">Data Inicial</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dataInicial"
                    type="date"
                    value={dataInicial}
                    onChange={(e) => setDataInicial(e.target.value)}
                    onBlur={handleDateFilter}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataFinal">Data Final</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dataFinal"
                    type="date"
                    value={dataFinal}
                    onChange={(e) => setDataFinal(e.target.value)}
                    onBlur={handleDateFilter}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Eventos Recebidos
              </CardTitle>
              {data && (
                <span className="text-sm text-muted-foreground">
                  {data.totalCount} evento(s) encontrado(s)
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.events.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum evento encontrado</h3>
                <p className="text-muted-foreground mt-1">
                  Ajuste os filtros ou aguarde novos eventos do SGT.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Lead ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.events.map((event) => (
                        <TableRow key={event.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">
                            {format(new Date(event.recebido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <EmpresaBadge empresa={event.empresa} />
                          </TableCell>
                          <TableCell>
                            <EventoLabel evento={event.evento} />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {event.lead_id}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={getStatusFromLogs(event.sgt_event_logs)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEventId(event.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {page} de {data.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                        disabled={page === data.totalPages}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Event Details Modal */}
      <Dialog open={!!selectedEventId} onOpenChange={() => setSelectedEventId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Evento</DialogTitle>
            <DialogDescription>
              Informações completas do evento SGT recebido
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : eventDetails ? (
            <Tabs defaultValue="payload" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="payload">Payload</TabsTrigger>
                <TabsTrigger value="contato">Contato</TabsTrigger>
                <TabsTrigger value="classificacao">Classificação</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              
              <TabsContent value="payload" className="mt-4">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(eventDetails.event.payload, null, 2)}
                  </pre>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="contato" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {eventDetails.leadContact ? (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Dados do Contato</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">Nome</Label>
                              <p className="font-medium">{eventDetails.leadContact.nome || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Primeiro Nome</Label>
                              <p className="font-medium">{eventDetails.leadContact.primeiro_nome || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <p className="font-medium">{eventDetails.leadContact.email || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Telefone</Label>
                              <p className="font-medium">{eventDetails.leadContact.telefone || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Empresa</Label>
                              <EmpresaBadge empresa={eventDetails.leadContact.empresa} />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Atualizado em</Label>
                              <p className="text-sm">
                                {format(new Date(eventDetails.leadContact.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhum contato registrado para este lead.</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="classificacao" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {eventDetails.classification ? (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Classificação Comercial</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">ICP</Label>
                              <Badge variant="outline" className="mt-1">{eventDetails.classification.icp}</Badge>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Persona</Label>
                              <Badge variant="outline" className="mt-1">{eventDetails.classification.persona || '-'}</Badge>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Temperatura</Label>
                              <Badge 
                                className={`mt-1 ${
                                  eventDetails.classification.temperatura === 'QUENTE' 
                                    ? 'bg-destructive text-destructive-foreground' 
                                    : eventDetails.classification.temperatura === 'MORNO'
                                    ? 'bg-warning text-warning-foreground'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {eventDetails.classification.temperatura}
                              </Badge>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Prioridade</Label>
                              <p className="font-bold text-lg">{eventDetails.classification.prioridade}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Score Interno</Label>
                              <p className="font-medium">{eventDetails.classification.score_interno || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Classificado em</Label>
                              <p className="text-sm">
                                {format(new Date(eventDetails.classification.classificado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {eventDetails.cadenceRun && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Cadência Iniciada</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Cadência</Label>
                                <p className="font-medium">
                                  {(eventDetails.cadenceRun as any).cadences?.nome || eventDetails.cadenceRun.cadence_id}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Status</Label>
                                <Badge variant="outline" className="mt-1">{eventDetails.cadenceRun.status}</Badge>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Próximo Step</Label>
                                <p className="font-medium">{eventDetails.cadenceRun.next_step_ordem || '-'}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Próxima Execução</Label>
                                <p className="text-sm">
                                  {eventDetails.cadenceRun.next_run_at 
                                    ? format(new Date(eventDetails.cadenceRun.next_run_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                    : '-'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>Sem classificação registrada para este lead.</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="logs" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {eventDetails.event.sgt_event_logs && eventDetails.event.sgt_event_logs.length > 0 ? (
                    <div className="space-y-3">
                      {eventDetails.event.sgt_event_logs
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((log) => (
                          <Card key={log.id} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={log.status} />
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                  </span>
                                </div>
                                {log.mensagem && (
                                  <p className="text-sm">{log.mensagem}</p>
                                )}
                                {log.erro_stack && (
                                  <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2 overflow-x-auto">
                                    {log.erro_stack}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhum log encontrado.</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
