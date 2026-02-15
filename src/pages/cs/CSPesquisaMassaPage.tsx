import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { useCSCustomers } from '@/hooks/useCSCustomers';
import { useCSMassSurvey } from '@/hooks/useCSMassSurvey';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Users, CheckCircle2, XCircle, Search } from 'lucide-react';
import { healthStatusConfig, npsConfig } from '@/types/customerSuccess';
import type { CSHealthStatus, CSNpsCategoria, CSCustomer } from '@/types/customerSuccess';
import { toast } from 'sonner';

export default function CSPesquisaMassaPage() {
  const [search, setSearch] = useState('');
  const [filterHealth, setFilterHealth] = useState('ALL');
  const [filterNps, setFilterNps] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<'NPS' | 'CSAT'>('NPS');

  // Fetch all active customers (page 0, large set)
  const { data: customersData, isLoading } = useCSCustomers({ is_active: true }, 0);
  const allCustomers = customersData?.data ?? [];

  const { sending, progress, total, results, done, sendBulk, reset } = useCSMassSurvey();

  const filtered = useMemo(() => {
    let list = allCustomers;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.contact?.nome?.toLowerCase().includes(s) ||
        c.contact?.email?.toLowerCase().includes(s)
      );
    }
    if (filterHealth !== 'ALL') {
      list = list.filter(c => c.health_status === filterHealth);
    }
    if (filterNps !== 'ALL') {
      list = list.filter(c => c.nps_categoria === filterNps);
    }
    return list;
  }, [allCustomers, search, filterHealth, filterNps]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }
    const ids = Array.from(selectedIds);
    const results = await sendBulk(ids, tipo);
    const successCount = results.filter(r => r.success).length;
    toast.success(`${successCount}/${results.length} pesquisas enviadas com sucesso`);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        <PageShell icon={Send} title="Pesquisa em Massa" description="Envie NPS ou CSAT para múltiplos clientes CS" />

        <div className="px-6 pb-6 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <div className="w-[160px]">
                  <Label className="text-xs">Health Status</Label>
                  <Select value={filterHealth} onValueChange={setFilterHealth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="SAUDAVEL">Saudável</SelectItem>
                      <SelectItem value="ATENCAO">Atenção</SelectItem>
                      <SelectItem value="EM_RISCO">Em Risco</SelectItem>
                      <SelectItem value="CRITICO">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[160px]">
                  <Label className="text-xs">NPS Categoria</Label>
                  <Select value={filterNps} onValueChange={setFilterNps}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="PROMOTOR">Promotor</SelectItem>
                      <SelectItem value="NEUTRO">Neutro</SelectItem>
                      <SelectItem value="DETRATOR">Detrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[140px]">
                  <Label className="text-xs">Tipo Pesquisa</Label>
                  <Select value={tipo} onValueChange={v => setTipo(v as 'NPS' | 'CSAT')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NPS">NPS</SelectItem>
                      <SelectItem value="CSAT">CSAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} de {filtered.length} selecionados
            </p>
            <Button onClick={handleSend} disabled={sending || selectedIds.size === 0}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? `Enviando ${progress}/${total}...` : `Enviar ${tipo} para ${selectedIds.size} clientes`}
            </Button>
          </div>

          {/* Progress */}
          {(sending || done) && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Progress value={total > 0 ? (progress / total) * 100 : 0} className="h-2" />
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{progress}/{total} processados</span>
                  {done && (
                    <>
                      <span className="flex items-center gap-1 text-chart-2"><CheckCircle2 className="h-4 w-4" /> {successCount} sucesso</span>
                      {failCount > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> {failCount} falhas</span>}
                    </>
                  )}
                </div>
                {done && (
                  <Button variant="outline" size="sm" onClick={reset}>Limpar resultado</Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>NPS</TableHead>
                    <TableHead>CSAT</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>CSM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
                  ) : filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => toggleSelect(c.id)}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={c.contact?.foto_url || undefined} />
                            <AvatarFallback className="text-xs">{c.contact?.nome?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{c.contact?.nome || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">{c.contact?.email || ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={healthStatusConfig[c.health_status]?.bgClass || ''}>
                          {c.health_score} — {healthStatusConfig[c.health_status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.nps_categoria ? (
                          <Badge variant="outline" className={npsConfig[c.nps_categoria]?.bgClass}>{c.ultimo_nps}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>{c.media_csat != null ? c.media_csat.toFixed(1) : '—'}</TableCell>
                      <TableCell className="font-medium text-sm">R$ {(c.valor_mrr ?? 0).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-sm">{c.csm?.nome || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
