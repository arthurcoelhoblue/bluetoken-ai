import { useState, useEffect } from 'react';
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
import { Phone, Plus, Trash2, RefreshCw, Check, Copy, TestTube2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useZadarmaConfig,
  useSaveZadarmaConfig,
  useZadarmaExtensions,
  useSaveExtension,
  useDeleteExtension,
  useCallStats,
  useZadarmaProxy,
} from '@/hooks/useZadarma';
import type { EmpresaTipo } from '@/types/telephony';

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

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [webrtcEnabled, setWebrtcEnabled] = useState(true);
  const [empresasAtivas, setEmpresasAtivas] = useState<string[]>([]);

  // Sync form with loaded config
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

  const webhookUrl = `${window.location.origin.replace('localhost', 'YOUR_SUPABASE_URL')}/functions/v1/zadarma-webhook`;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Telefonia Zadarma</h1>
        <p className="text-muted-foreground">Configuração global de telefonia VoIP — canal único compartilhado entre empresas</p>
      </div>
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="ramais">Ramais</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        {/* Config Tab - Global */}
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

                  <div className="space-y-2">
                    <Label>URL do Webhook (copiar para Zadarma)</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={webhookUrl} className="text-xs font-mono" />
                      <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copiado!'); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

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

        {/* Extensions Tab - per empresa */}
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

        {/* Stats Tab - per empresa */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estatísticas de Chamadas — {activeEmpresa}</CardTitle>
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
                      <TableCell className="text-right text-success">{s.atendidas}</TableCell>
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
