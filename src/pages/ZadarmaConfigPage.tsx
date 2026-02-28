import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Plus, Trash2, RefreshCw, Check, Copy, TestTube2, BarChart3, Wifi, WifiOff, Settings2, Loader2, DollarSign, Clock, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import {
  useZadarmaConfig,
  useSaveZadarmaConfig,
  useZadarmaExtensions,
  useSaveExtension,
  useDeleteExtension,
  useCallStats,
  useZadarmaProxy,
  useZadarmaStatistics,
  useZadarmaTariff,
  useExtensionStatuses,
} from '@/hooks/useZadarma';
import type { EmpresaTipo } from '@/types/telephony';

// ─── Stats Cards ─────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Extension Status Indicator ──────────────────────
function StatusDot({ status }: { status?: string }) {
  if (status === 'online') return <Badge variant="default" className="bg-green-500 text-white text-[10px] px-1.5">Online</Badge>;
  if (status === 'busy') return <Badge variant="default" className="bg-amber-500 text-white text-[10px] px-1.5">Ocupado</Badge>;
  return <Badge variant="secondary" className="text-[10px] px-1.5">Offline</Badge>;
}

// ─── Direct Numbers Tab ──────────────────────────────
function DirectNumbersTab({ empresa, proxy }: { empresa: EmpresaTipo; proxy: ReturnType<typeof useZadarmaProxy> }) {
  const [numbers, setNumbers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadNumbers = async () => {
    setLoading(true);
    try {
      const result = await proxy.mutateAsync({ action: 'get_direct_numbers', empresa });
      const list = result?.info?.direct_numbers || result?.direct_numbers || [];
      setNumbers(Array.isArray(list) ? list : []);
      setLoaded(true);
    } catch (e: unknown) {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!loaded) loadNumbers(); }, [loaded]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          🌐 Números Virtuais
        </CardTitle>
        <CardDescription>Números comprados no Zadarma — inventário e status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <Button variant="outline" size="sm" onClick={loadNumbers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
        {loading && !loaded ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : numbers.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Nenhum número virtual encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Canais</TableHead>
                <TableHead className="text-right">Custo/mês</TableHead>
                <TableHead className="text-center">Auto-renovar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((n, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono font-medium">{String(n.number || n.did || '—')}</TableCell>
                  <TableCell>{String(n.country || '—')}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={n.status === 'on' || n.status === 'active' ? 'default' : 'secondary'}>
                      {String(n.status || '—')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{String(n.channels || n.lines || '—')}</TableCell>
                  <TableCell className="text-right">{n.monthly_cost ? `${n.monthly_cost} ${n.currency || 'USD'}` : '—'}</TableCell>
                  <TableCell className="text-center">{n.auto_renewal ? '✅' : '❌'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Redirection Tab ─────────────────────────────────
function RedirectionTab({ empresa, extensions, proxy }: { empresa: EmpresaTipo; extensions: Array<{ id: string; extension_number: string; user_nome?: string; sip_login?: string | null }>; proxy: ReturnType<typeof useZadarmaProxy> }) {
  const [redirections, setRedirections] = useState<Record<string, { type?: string; destination?: string; loading?: boolean }>>({});
  const [loaded, setLoaded] = useState(false);

  const loadRedirections = async () => {
    const results: Record<string, { type?: string; destination?: string }> = {};
    for (const ext of extensions) {
      if (!ext.sip_login) continue;
      try {
        const result = await proxy.mutateAsync({
          action: 'get_redirection',
          empresa,
          payload: { sip_id: ext.sip_login },
        });
        results[ext.extension_number] = {
          type: result?.info?.condition || result?.condition || '—',
          destination: result?.info?.destination || result?.destination || '—',
        };
      } catch {
        results[ext.extension_number] = { type: 'erro', destination: '—' };
      }
    }
    setRedirections(results);
    setLoaded(true);
  };

  useEffect(() => { if (!loaded && extensions.length > 0) loadRedirections(); }, [loaded, extensions.length]);

  const handleSetRedirection = async (ext: typeof extensions[0], type: string, destination: string) => {
    if (!ext.sip_login) { toast.error('SIP Login necessário para configurar encaminhamento'); return; }
    setRedirections(prev => ({ ...prev, [ext.extension_number]: { ...prev[ext.extension_number], loading: true } }));
    try {
      await proxy.mutateAsync({
        action: 'set_redirection',
        empresa,
        payload: { sip_id: ext.sip_login, type, destination },
      });
      toast.success(`Encaminhamento do ramal ${ext.extension_number} atualizado!`);
      setRedirections(prev => ({ ...prev, [ext.extension_number]: { type, destination, loading: false } }));
    } catch (e: unknown) {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
      setRedirections(prev => ({ ...prev, [ext.extension_number]: { ...prev[ext.extension_number], loading: false } }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">↪️ Encaminhamento de Chamadas — {empresa}</CardTitle>
        <CardDescription>Configure para onde redirecionar quando o vendedor não atende (fallback)</CardDescription>
      </CardHeader>
      <CardContent>
        {extensions.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Nenhum ramal mapeado.</p>
        ) : (
          <div className="space-y-4">
            {extensions.map(ext => {
              const redir = redirections[ext.extension_number] || {};
              return (
                <Card key={ext.id} className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{ext.user_nome || 'Sem usuário'}</p>
                        <p className="text-xs text-muted-foreground font-mono">Ramal {ext.extension_number} {ext.sip_login ? `(${ext.sip_login})` : '(sem SIP)'}</p>
                      </div>
                      {redir.type && redir.type !== 'erro' && (
                        <Badge variant="secondary" className="text-xs">
                          {redir.type === 'noanswer' ? 'Sem resposta' : redir.type === 'always' ? 'Sempre' : redir.type}
                        </Badge>
                      )}
                    </div>
                    {ext.sip_login ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={redir.type || 'noanswer'}
                          onValueChange={(val) => setRedirections(prev => ({ ...prev, [ext.extension_number]: { ...prev[ext.extension_number], type: val } }))}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="noanswer">Sem resposta</SelectItem>
                            <SelectItem value="always">Sempre</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          className="w-44 font-mono text-sm"
                          placeholder="Número destino"
                          value={redir.destination === '—' ? '' : redir.destination || ''}
                          onChange={e => setRedirections(prev => ({ ...prev, [ext.extension_number]: { ...prev[ext.extension_number], destination: e.target.value } }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={redir.loading || !redir.destination || redir.destination === '—'}
                          onClick={() => handleSetRedirection(ext, redir.type || 'noanswer', redir.destination || '')}
                        >
                          {redir.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Configure o SIP Login para gerenciar encaminhamento.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ZadarmaConfigContent() {
  const { activeCompany, empresaRecords } = useCompany();
  const activeEmpresa: EmpresaTipo = activeCompany as EmpresaTipo;
  const activeEmpresas = empresaRecords.filter(e => e.is_active);

  const { data: config, isLoading: configLoading } = useZadarmaConfig();
  const saveConfig = useSaveZadarmaConfig();
  const { data: extensions = [], isLoading: extLoading } = useZadarmaExtensions(activeEmpresa);
  const saveExtension = useSaveExtension();
  const deleteExtension = useDeleteExtension();
  const { data: stats = [] } = useCallStats(activeEmpresa);
  const proxy = useZadarmaProxy();

  // ─── Form state ───
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [webrtcEnabled, setWebrtcEnabled] = useState(true);
  const [empresasAtivas, setEmpresasAtivas] = useState<string[]>([]);

  // ─── Stats period ───
  const now = new Date();
  const [statsStart, setStatsStart] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [statsEnd, setStatsEnd] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  // ─── Zadarma API data ───
  const { data: zadarmaStats, isLoading: zadarmaStatsLoading, refetch: refetchStats } = useZadarmaStatistics(activeEmpresa, statsStart, statsEnd);
  const { data: tariff, isLoading: tariffLoading } = useZadarmaTariff(activeEmpresa);
  const { data: extStatuses = [] } = useExtensionStatuses(
    activeEmpresa,
    extensions.map(e => ({ extension_number: e.extension_number, user_nome: e.user_nome }))
  );

  // ─── Webhook auto-config state ───
  const [isConfiguringWebhook, setIsConfiguringWebhook] = useState(false);

  useEffect(() => {
    if (config) {
      setApiKey(config.api_key || '');
      setApiSecret(config.api_secret || '');
      setWebhookEnabled(config.webhook_enabled);
      setWebrtcEnabled(config.webrtc_enabled);
      setEmpresasAtivas(config.empresas_ativas || []);
    }
  }, [config]);

  const toggleEmpresa = (codigo: string) => {
    setEmpresasAtivas(prev =>
      prev.includes(codigo) ? prev.filter(e => e !== codigo) : [...prev, codigo]
    );
  };

  const handleSaveConfig = () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error('Preencha API Key e API Secret');
      return;
    }
    saveConfig.mutate({
      id: config?.id,
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
      webhook_enabled: webhookEnabled,
      webrtc_enabled: webrtcEnabled,
      empresas_ativas: empresasAtivas,
    }, {
      onSuccess: () => toast.success('Configuração salva!'),
      onError: (e) => toast.error(`Erro: ${e.message}`),
    });
  };

  const handleTestConnection = () => {
    proxy.mutate({ action: 'test_connection', empresa: activeEmpresa }, {
      onSuccess: (data) => {
        if (data?.status === 'success') toast.success(`Conexão OK — Saldo: ${data.balance} ${data.currency}`);
        else toast.info('Resposta recebida');
      },
      onError: (e) => toast.error(`Falha: ${e.message}`),
    });
  };

  // ─── Auto-configure webhook ───
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = `${supabaseUrl}/functions/v1/zadarma-webhook`;

  const handleAutoConfigWebhook = async () => {
    setIsConfiguringWebhook(true);
    try {
      await proxy.mutateAsync({
        action: 'set_webhooks',
        empresa: activeEmpresa,
        payload: {
          webhook_url: webhookUrl,
          notify_start: true,
          notify_end: true,
          notify_answer: true,
          notify_out_start: true,
          notify_out_end: true,
          notify_internal: false,
          speech_recognition: true,
        },
      });
      toast.success('Webhook configurado automaticamente no Zadarma!');
    } catch (e: unknown) {
      toast.error(`Erro ao configurar webhook: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsConfiguringWebhook(false);
    }
  };

  // ─── Parse Zadarma stats ───
  const parsedStats = useMemo(() => {
    if (!zadarmaStats?.stats) return [];
    const items = Array.isArray(zadarmaStats.stats) ? zadarmaStats.stats : [];
    return items as Array<{
      id?: string;
      sip?: string;
      callstart?: string;
      from?: string;
      to?: string;
      duration?: number;
      billseconds?: number;
      disposition?: string;
      cost?: number;
      currency?: string;
      pbx_call_id?: string;
      is_recorded?: number;
    }>;
  }, [zadarmaStats]);

  const totalCost = useMemo(() => parsedStats.reduce((sum, s) => sum + (Number(s.cost) || 0), 0), [parsedStats]);
  const totalCalls = parsedStats.length;
  const answeredCalls = parsedStats.filter(s => s.disposition === 'answered').length;
  const totalDuration = parsedStats.reduce((sum, s) => sum + (Number(s.billseconds) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Telefonia Zadarma</h1>
        <p className="text-muted-foreground">Configuração global de telefonia VoIP — canal único compartilhado entre empresas</p>
      </div>
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
          <TabsTrigger value="status">🟢 Status Ramais</TabsTrigger>
          <TabsTrigger value="config">⚙️ Configuração</TabsTrigger>
          <TabsTrigger value="ramais">📞 Ramais</TabsTrigger>
          <TabsTrigger value="numeros">🌐 Números</TabsTrigger>
          <TabsTrigger value="encaminhamento">↪️ Encaminhamento</TabsTrigger>
          <TabsTrigger value="stats">📈 Estatísticas CRM</TabsTrigger>
        </TabsList>

        {/* ─── Dashboard Tab ────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">De:</Label>
              <Input type="date" value={statsStart} onChange={e => setStatsStart(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Até:</Label>
              <Input type="date" value={statsEnd} onChange={e => setStatsEnd(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchStats()} disabled={zadarmaStatsLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${zadarmaStatsLoading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Phone} label="Total Chamadas" value={totalCalls} color="text-primary" />
            <StatCard icon={PhoneIncoming} label="Atendidas" value={answeredCalls} sub={totalCalls > 0 ? `${Math.round(answeredCalls / totalCalls * 100)}%` : '—'} color="text-green-600" />
            <StatCard icon={Clock} label="Duração Total" value={`${Math.floor(totalDuration / 60)}min`} sub={totalCalls > 0 ? `Média: ${Math.floor(totalDuration / Math.max(answeredCalls, 1))}s` : '—'} color="text-blue-600" />
            <StatCard icon={DollarSign} label="Custo Total" value={`${totalCost.toFixed(2)}`} sub={parsedStats[0]?.currency || 'USD'} color="text-amber-600" />
          </div>

          {/* Tariff info */}
          {tariff && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Plano Atual</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Plano:</span> {tariff.info?.tariff_name || '—'}</p>
                <p><span className="text-muted-foreground">Minutos usados:</span> {tariff.info?.used_seconds ? Math.floor(Number(tariff.info.used_seconds) / 60) : 0}min</p>
                <p><span className="text-muted-foreground">Custo mensal:</span> {tariff.info?.cost || '—'} {tariff.info?.currency || ''}</p>
              </CardContent>
            </Card>
          )}

          {/* Detailed call list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Chamadas Detalhadas (Zadarma PBX)</CardTitle>
            </CardHeader>
            <CardContent>
              {zadarmaStatsLoading ? (
                <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
              ) : parsedStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Sem dados para o período selecionado.</p>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>De</TableHead>
                        <TableHead>Para</TableHead>
                        <TableHead className="text-right">Duração</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-center">Gravação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedStats.slice(0, 100).map((s, i) => (
                        <TableRow key={s.id || i}>
                          <TableCell className="text-xs whitespace-nowrap">{s.callstart || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{s.from || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{s.to || '—'}</TableCell>
                          <TableCell className="text-right text-xs">{s.billseconds ? `${Math.floor(Number(s.billseconds) / 60)}:${(Number(s.billseconds) % 60).toString().padStart(2, '0')}` : '0:00'}</TableCell>
                          <TableCell className="text-center">
                            {s.disposition === 'answered' ? (
                              <Badge variant="default" className="bg-green-500 text-white text-[10px]">Atendida</Badge>
                            ) : s.disposition === 'busy' ? (
                              <Badge variant="secondary" className="text-[10px]">Ocupado</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">{s.disposition || 'N/A'}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs">{s.cost ? `${Number(s.cost).toFixed(3)}` : '—'}</TableCell>
                          <TableCell className="text-center">{s.is_recorded ? '🎙️' : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Status Ramais Tab ────────────────────── */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="h-4 w-4" /> Disponibilidade dos Ramais — {activeEmpresa}
              </CardTitle>
              <CardDescription>Status em tempo real dos vendedores (atualiza a cada 30s)</CardDescription>
            </CardHeader>
            <CardContent>
              {extensions.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Nenhum ramal mapeado para esta empresa.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {extensions.map(ext => {
                    const statusInfo = extStatuses.find((s: Record<string, unknown>) => s.extension === ext.extension_number);
                    const onlineStatus = statusInfo?.status as string | undefined;
                    return (
                      <Card key={ext.id} className="border">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{ext.user_nome || 'Sem usuário'}</p>
                              <p className="text-xs text-muted-foreground font-mono">Ramal {ext.extension_number}</p>
                            </div>
                          </div>
                          <StatusDot status={onlineStatus} />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Config Tab ───────────────────────────── */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Zadarma — Configuração Global</CardTitle>
              <CardDescription>Credenciais únicas compartilhadas entre todas as empresas. Ative/desative por empresa abaixo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configLoading ? (
                <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Zadarma API Key" />
                  </div>
                  <div className="space-y-2">
                    <Label>API Secret</Label>
                    <Input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="Zadarma API Secret" />
                  </div>

                  <div className="space-y-2">
                    <Label>Empresas com telefonia ativa</Label>
                    <div className="flex flex-wrap gap-3">
                      {activeEmpresas.map(emp => (
                        <label key={emp.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={empresasAtivas.includes(emp.id)}
                            onCheckedChange={() => toggleEmpresa(emp.id)}
                          />
                          <span className="text-sm">{emp.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
                      <Label className="text-sm">Webhook ativo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={webrtcEnabled} onCheckedChange={setWebrtcEnabled} />
                      <Label className="text-sm">WebRTC ativo</Label>
                    </div>
                  </div>

                  {/* Webhook auto-config section */}
                  <Card className="border-dashed">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Auto-configuração de Webhook</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Clique para configurar automaticamente a URL do webhook e ativar todas as notificações necessárias no Zadarma (sem precisar acessar o painel).
                      </p>
                      <div className="flex items-center gap-2">
                        <Input readOnly value={webhookUrl} className="text-xs font-mono flex-1" />
                        <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copiado!'); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="secondary" onClick={handleAutoConfigWebhook} disabled={isConfiguringWebhook || !config}>
                        {isConfiguringWebhook ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Settings2 className="h-4 w-4 mr-1" />}
                        Configurar Webhook Automaticamente
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveConfig} disabled={saveConfig.isPending}>
                      <Check className="h-4 w-4 mr-1" /> Salvar
                    </Button>
                    <Button variant="outline" onClick={handleTestConnection} disabled={proxy.isPending}>
                      <TestTube2 className="h-4 w-4 mr-1" /> Testar Conexão
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Extensions Tab ───────────────────────── */}
        <TabsContent value="ramais" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapeamento de Ramais — {activeEmpresa}</CardTitle>
              <CardDescription>Vincule ramais PBX a usuários do CRM (filtrado pela empresa ativa)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ramal</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>SIP Login</TableHead>
                    <TableHead className="w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extensions.map(ext => (
                    <TableRow key={ext.id}>
                      <TableCell className="font-mono">{ext.extension_number}</TableCell>
                      <TableCell>{ext.user_nome || ext.user_id}</TableCell>
                      <TableCell className="font-mono text-xs">{ext.sip_login || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExtension.mutate(ext.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {extensions.length === 0 && !extLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum ramal mapeado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── CRM Stats Tab ────────────────────────── */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estatísticas de Chamadas CRM — {activeEmpresa}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Atendidas</TableHead>
                    <TableHead className="text-right">Perdidas</TableHead>
                    <TableHead className="text-right">Dur. Média</TableHead>
                    <TableHead className="text-right">Dur. Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map(s => (
                    <TableRow key={`${s.user_id}-${s.ano}-${s.mes}`}>
                      <TableCell>{s.user_nome || '—'}</TableCell>
                      <TableCell className="text-right">{s.total_chamadas}</TableCell>
                      <TableCell className="text-right text-green-600">{s.atendidas}</TableCell>
                      <TableCell className="text-right text-destructive">{s.perdidas}</TableCell>
                      <TableCell className="text-right">{Math.floor(s.duracao_media / 60)}:{(s.duracao_media % 60).toString().padStart(2, '0')}</TableCell>
                      <TableCell className="text-right">{Math.floor(s.duracao_total / 60)}min</TableCell>
                    </TableRow>
                  ))}
                  {stats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem dados de chamadas.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Direct Numbers Tab ───────────────────── */}
        <TabsContent value="numeros" className="space-y-4">
          <DirectNumbersTab empresa={activeEmpresa} proxy={proxy} />
        </TabsContent>

        {/* ─── Redirection Tab ──────────────────────── */}
        <TabsContent value="encaminhamento" className="space-y-4">
          <RedirectionTab empresa={activeEmpresa} extensions={extensions} proxy={proxy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ZadarmaConfigPage() {
  return (
    <AppLayout>
      <ZadarmaConfigContent />
    </AppLayout>
  );
}
