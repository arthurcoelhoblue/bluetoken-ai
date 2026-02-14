import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Target, ChevronLeft, ChevronRight, Trophy, Crown, DollarSign, TrendingUp, PieChart, Edit2, CalendarRange } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjecaoStageCard } from '@/components/ProjecaoStageCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MetaAnualDialog } from '@/components/metas/MetaAnualDialog';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useMetaProgresso, useComissaoRegras, useComissaoLancamentos, useUpdateComissaoStatus, useUpsertMeta } from '@/hooks/useMetas';
import { MESES_LABEL, type ComissaoStatus, type MetaProgresso } from '@/types/metas';
import { LeaderboardCard } from '@/components/gamification/LeaderboardCard';
import { BadgeShowcase } from '@/components/gamification/BadgeShowcase';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MetasPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const { hasRole, user } = useAuth();
  const { activeCompany } = useCompany();
  const empresa = activeCompany === 'ALL' ? undefined : activeCompany;
  const isAdmin = hasRole('ADMIN');

  const { data: ranking = [], isLoading: loadingRanking } = useMetaProgresso(ano, mes);
  const { data: regras = [], isLoading: loadingRegras } = useComissaoRegras();
  const { data: lancamentos = [], isLoading: loadingLanc } = useComissaoLancamentos(ano, mes);
  const updateStatus = useUpdateComissaoStatus();
  const upsertMeta = useUpsertMeta();

  const [editMeta, setEditMeta] = useState<MetaProgresso | null>(null);
  const [metaValor, setMetaValor] = useState('');
  const [metaDeals, setMetaDeals] = useState('');
  const [metaAnualOpen, setMetaAnualOpen] = useState(false);

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAno(a => a - 1); }
    else setMes(m => m - 1);
  };
  const nextMonth = () => {
    if (mes === 12) { setMes(1); setAno(a => a + 1); }
    else setMes(m => m + 1);
  };

  // KPIs
  const totalMeta = ranking.reduce((s, r) => s + Number(r.meta_valor), 0);
  const totalRealizado = ranking.reduce((s, r) => s + Number(r.realizado_valor), 0);
  const pctGeral = totalMeta > 0 ? Math.round(totalRealizado / totalMeta * 100) : 0;
  const totalComissoes = ranking.reduce((s, r) => s + Number(r.comissao_mes), 0);
  const totalPipeline = ranking.reduce((s, r) => s + Number(r.pipeline_aberto), 0);

  const openEditMeta = (r: MetaProgresso) => {
    setEditMeta(r);
    setMetaValor(String(r.meta_valor));
    setMetaDeals(String(r.meta_deals));
  };

  const saveMeta = () => {
    if (!editMeta) return;
    upsertMeta.mutate({
      user_id: editMeta.user_id,
      empresa: editMeta.empresa,
      ano, mes,
      meta_valor: parseFloat(metaValor) || 0,
      meta_deals: parseInt(metaDeals) || 0,
    }, { onSuccess: () => setEditMeta(null) });
  };

  const medalColor = (i: number) => {
    if (i === 0) return 'text-yellow-500';
    if (i === 1) return 'text-gray-400';
    if (i === 2) return 'text-amber-700';
    return 'text-muted-foreground';
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Metas & Comissões</h1>
              <p className="text-sm text-muted-foreground">Acompanhe metas, ranking e comissões</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setMetaAnualOpen(true)}>
                <CalendarRange className="h-4 w-4 mr-1" /> Meta Anual
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-medium min-w-[140px] text-center">{MESES_LABEL[mes]} {ano}</span>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Meta Total', value: fmt(totalMeta), icon: Target },
            { label: 'Realizado', value: fmt(totalRealizado), icon: TrendingUp },
            { label: '% Atingido', value: `${pctGeral}%`, icon: PieChart },
            { label: 'Comissões', value: fmt(totalComissoes), icon: DollarSign },
            { label: 'Pipeline', value: fmt(totalPipeline), icon: Trophy },
          ].map(k => (
            <Card key={k.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <k.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-lg font-bold">{loadingRanking ? '...' : k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projeção por Etapa */}
        <ProjecaoStageCard
          userId={user?.id}
          empresa={empresa}
          metaValor={totalMeta}
          vendidoAtual={totalRealizado}
        />

        {/* Tabs */}
        <Tabs defaultValue="ranking">
          <TabsList>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="gamificacao">Gamificação</TabsTrigger>
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            <TabsTrigger value="regras">Regras</TabsTrigger>
          </TabsList>

          {/* Ranking */}
          <TabsContent value="ranking" className="space-y-3 mt-4">
            {loadingRanking ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : ranking.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma meta cadastrada para {MESES_LABEL[mes]} {ano}</CardContent></Card>
            ) : ranking.map((r, i) => (
              <Card key={r.meta_id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center gap-2 shrink-0 w-8">
                    {i < 3 ? <Crown className={`h-5 w-5 ${medalColor(i)}`} /> : <span className="text-sm text-muted-foreground font-medium">{i + 1}º</span>}
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={r.vendedor_avatar || undefined} />
                    <AvatarFallback>{r.vendedor_nome?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{r.vendedor_nome}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold">{fmt(Number(r.realizado_valor))}</span>
                        <span className="text-xs text-muted-foreground">/ {fmt(Number(r.meta_valor))}</span>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMeta(r)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Progress value={Math.min(Number(r.pct_valor), 100)} className="h-2 mt-1" />
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{r.realizado_deals}/{r.meta_deals} deals</span>
                      <span>Comissão: {fmt(Number(r.comissao_mes))}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Gamificação */}
          <TabsContent value="gamificacao" className="space-y-4 mt-4">
            <LeaderboardCard />
            <BadgeShowcase />
          </TabsContent>

          {/* Comissões */}
          <TabsContent value="comissoes" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loadingLanc ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : lancamentos.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Nenhum lançamento para {MESES_LABEL[mes]} {ano}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Valor Deal</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lancamentos.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium truncate max-w-[200px]">{l.deal_titulo || l.deal_id.slice(0, 8)}</TableCell>
                          <TableCell>{l.vendedor_nome}</TableCell>
                          <TableCell className="text-right">{fmt(Number(l.deal_valor))}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(Number(l.comissao_valor))}</TableCell>
                          <TableCell className="text-right">{l.percentual_aplicado}%</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Select
                                value={l.status}
                                onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v as ComissaoStatus })}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                                  <SelectItem value="PAGO">Pago</SelectItem>
                                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={l.status === 'PAGO' ? 'default' : l.status === 'APROVADO' ? 'secondary' : 'outline'}>
                                {l.status}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regras */}
          <TabsContent value="regras" className="space-y-3 mt-4">
            {loadingRegras ? (
              <Skeleton className="h-24 w-full" />
            ) : regras.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma regra de comissão cadastrada</CardContent></Card>
            ) : regras.map(r => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{r.nome}</CardTitle>
                    <Badge variant={r.ativo ? 'default' : 'outline'}>{r.ativo ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>Tipo: <span className="font-medium text-foreground">{r.tipo}</span></p>
                  {r.tipo === 'PERCENTUAL' && <p>Percentual: <span className="font-medium text-foreground">{r.percentual}%</span></p>}
                  {r.tipo === 'FIXO' && <p>Valor fixo: <span className="font-medium text-foreground">{fmt(Number(r.valor_fixo))}</span></p>}
                  {r.tipo === 'ESCALONADO' && r.escalas && (
                    <div>
                      <p>Faixas:</p>
                      <ul className="list-disc pl-5">
                        {r.escalas.map((f, i) => (
                          <li key={i}>
                            {f.ate ? `Até ${fmt(f.ate)}` : 'Acima'}: <span className="font-medium text-foreground">{f.percentual}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Number(r.valor_minimo_deal) > 0 && <p>Valor mínimo do deal: {fmt(Number(r.valor_minimo_deal))}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Edit Meta Dialog */}
        <Dialog open={!!editMeta} onOpenChange={(o) => !o && setEditMeta(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Meta — {editMeta?.vendedor_nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Meta Valor (R$)</Label>
                <Input type="number" value={metaValor} onChange={e => setMetaValor(e.target.value)} />
              </div>
              <div>
                <Label>Meta Deals (qtd)</Label>
                <Input type="number" value={metaDeals} onChange={e => setMetaDeals(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditMeta(null)}>Cancelar</Button>
              <Button onClick={saveMeta} disabled={upsertMeta.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Meta Anual Dialog */}
        <MetaAnualDialog
          open={metaAnualOpen}
          onOpenChange={setMetaAnualOpen}
          ano={ano}
          vendedores={ranking}
        />
      </div>
    </AppLayout>
  );
}
