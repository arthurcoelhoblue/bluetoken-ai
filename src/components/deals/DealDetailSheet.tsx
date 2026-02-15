import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Trophy, XCircle, RotateCcw, Pencil, Check, X, Clock, AlertTriangle,
  Plus, MessageSquare, Phone, Mail, CheckSquare, MoreHorizontal, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useDealDetail,
  useDealActivities,
  useAddDealActivity,
  useToggleTaskActivity,
  useUpdateDealField,
  useMoveDealStage,
  useReopenDeal,
  useDealPipelineStages,
} from '@/hooks/useDealDetail';
import { useCloseDeal, useLossCategories } from '@/hooks/useDeals';
import { useResolvedFields } from '@/hooks/useCustomFields';
import { CustomFieldsRenderer } from '@/components/contacts/CustomFieldsRenderer';
import { CopilotPanel } from '@/components/copilot/CopilotPanel';
import { DealCadenceCard } from '@/components/cadencias/DealCadenceCard';
import { DealCallsPanel } from '@/components/zadarma/DealCallsPanel';
import { EmailFromDealDialog } from '@/components/deals/EmailFromDealDialog';
import { DealTagsEditor } from '@/components/deals/DealTagsEditor';
import { ClickToCallButton } from '@/components/zadarma/ClickToCallButton';
import { InsightsTab } from '@/components/deals/DealInsightsTab';
import { FollowUpHintCard } from '@/components/deals/FollowUpHintCard';
import { ACTIVITY_LABELS, ACTIVITY_ICONS } from '@/types/dealDetail';
import type { DealActivityType } from '@/types/dealDetail';
import type { DealActivityMetadata } from '@/types/metadata';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailSheet({ dealId, open, onOpenChange }: Props) {
  const { data: deal, isLoading } = useDealDetail(dealId);
  const { data: activities } = useDealActivities(dealId);
  const { data: stages } = useDealPipelineStages(deal?.pipeline_id ?? null);
  const { data: lossCategories = [] } = useLossCategories();
  const resolvedFields = useResolvedFields('DEAL', dealId);

  const addActivity = useAddDealActivity();
  const toggleTask = useToggleTaskActivity();
  const updateField = useUpdateDealField();
  const moveStage = useMoveDealStage();
  const closeDeal = useCloseDeal();
  const reopenDeal = useReopenDeal();

  const [activityType, setActivityType] = useState<DealActivityType>('NOTA');
  const [activityText, setActivityText] = useState('');
  const [lossOpen, setLossOpen] = useState(false);
  const [lossMotivo, setLossMotivo] = useState('');
  const [lossCategoria, setLossCategoria] = useState('');
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);

  const isClosed = deal?.status === 'GANHO' || deal?.status === 'PERDIDO';

  const orderedStages = (stages ?? []).filter(s => !s.is_won && !s.is_lost).sort((a, b) => a.posicao - b.posicao);
  const currentStageIndex = orderedStages.findIndex(s => s.id === deal?.stage_id);
  const progressPercent = orderedStages.length > 1 ? ((currentStageIndex + 1) / orderedStages.length) * 100 : 0;

  const minutosNoStage = deal?.minutos_no_stage ?? 0;
  const horasNoStage = Math.floor(minutosNoStage / 60);
  const diasNoStage = Math.floor(horasNoStage / 24);
  const slaExcedido = deal?.sla_minutos ? minutosNoStage > deal.sla_minutos : false;

  const handleAddActivity = () => {
    if (!dealId || !activityText.trim()) return;
    addActivity.mutate({ deal_id: dealId, tipo: activityType, descricao: activityText.trim() }, {
      onSuccess: () => { setActivityText(''); toast.success('Atividade adicionada'); },
    });
  };

  const handleWin = () => {
    if (!deal) return;
    closeDeal.mutate({ dealId: deal.id, status: 'GANHO', stageId: deal.stage_id }, {
      onSuccess: () => toast.success('Deal marcado como ganho!'),
    });
  };

  const handleConfirmLoss = () => {
    if (!deal) return;
    if (!lossMotivo.trim() || !lossCategoria) {
      toast.error('Preencha todos os campos');
      return;
    }
    closeDeal.mutate({
      dealId: deal.id,
      status: 'PERDIDO',
      stageId: deal.stage_id,
      motivo_perda: lossMotivo.trim(),
      categoria_perda_closer: lossCategoria,
    }, {
      onSuccess: () => { setLossOpen(false); setLossMotivo(''); setLossCategoria(''); toast.info('Deal marcado como perdido'); },
    });
  };

  const handleReopen = () => {
    if (!deal || !orderedStages.length) return;
    reopenDeal.mutate({ dealId: deal.id, firstStageId: orderedStages[0].id }, {
      onSuccess: () => toast.success('Deal reaberto'),
    });
  };

  const handleStageClick = (stageId: string) => {
    if (!deal || isClosed || stageId === deal.stage_id) return;
    moveStage.mutate({ dealId: deal.id, toStageId: stageId }, {
      onSuccess: () => toast.success('Deal movido'),
    });
  };

  const startEdit = (field: string, value: string) => { setEditField(field); setEditValue(value || ''); };
  const saveEdit = () => {
    if (!dealId || !editField) return;
    updateField.mutate({ dealId, field: editField, value: editValue || null }, {
      onSuccess: () => { toast.success('Atualizado'); setEditField(null); },
    });
  };

  const renderInlineField = (label: string, field: string, value: string | null) => {
    const isEditing = editField === field;
    return (
      <div className="group flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">{label}</span>
          {isEditing ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit()} />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditField(null)}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <p className="text-sm truncate">{value || '—'}</p>
          )}
        </div>
        {!isEditing && (
          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => startEdit(field, value || '')}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col overflow-y-auto p-0">
          {isLoading ? (
            <div className="space-y-4 p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-8 w-3/4" /><Skeleton className="h-48 w-full" /></div>
          ) : deal ? (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b space-y-3">
                <SheetHeader className="p-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-lg truncate">{deal.titulo}</SheetTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{deal.pipeline_empresa}</Badge>
                        <Badge variant="outline" className="text-xs">{deal.pipeline_nome}</Badge>
                        {deal.stage_cor && (
                          <Badge variant="outline" className="text-xs" style={{ borderColor: deal.stage_cor, color: deal.stage_cor }}>
                            {deal.stage_nome}
                          </Badge>
                        )}
                        {isClosed && (
                          <Badge variant={deal.status === 'GANHO' ? 'default' : 'destructive'} className="text-xs">
                            {deal.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <ClickToCallButton
                        phone={deal.contact_telefone}
                        contactName={deal.contact_nome}
                        dealId={deal.id}
                      />
                      <CopilotPanel
                        context={{ type: 'DEAL', id: deal.id, empresa: deal.pipeline_empresa ?? '' }}
                        variant="icon"
                      />
                    </div>
                  </div>
                </SheetHeader>

                {/* Value + time in stage */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{formatBRL(deal.valor ?? 0)}</span>
                  <span className={`flex items-center gap-1 text-xs ${slaExcedido ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {slaExcedido && <AlertTriangle className="h-3 w-3" />}
                    <Clock className="h-3 w-3" />
                    {diasNoStage}d {horasNoStage % 24}h no estágio
                  </span>
                </div>

                {/* Progress bar */}
                {orderedStages.length > 0 && (
                  <div className="space-y-1.5">
                    <Progress value={progressPercent} className="h-2" />
                    <div className="flex justify-between">
                      {orderedStages.map((s, i) => (
                        <button
                          key={s.id}
                          onClick={() => handleStageClick(s.id)}
                          disabled={isClosed}
                          className={`text-[10px] px-1 py-0.5 rounded transition-colors ${
                            s.id === deal.stage_id
                              ? 'font-bold text-primary'
                              : i <= currentStageIndex
                                ? 'text-foreground hover:text-primary cursor-pointer'
                                : 'text-muted-foreground hover:text-foreground cursor-pointer'
                          } ${isClosed ? 'cursor-default' : ''}`}
                        >
                          {s.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {isClosed ? (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReopen}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5 text-success hover:text-success" onClick={handleWin}>
                        <Trophy className="h-3.5 w-3.5" /> Ganhar
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setLossOpen(true)}>
                        <XCircle className="h-3.5 w-3.5" /> Perder
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="timeline" className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-4 mx-6 mt-3" style={{ width: 'calc(100% - 3rem)' }}>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="campos">Campos</TabsTrigger>
                  <TabsTrigger value="insights">
                    <Sparkles className="h-3 w-3 mr-1" />
                    IA
                  </TabsTrigger>
                </TabsList>

                {/* Timeline */}
                <TabsContent value="timeline" className="flex-1 px-6 mt-3 space-y-4 overflow-y-auto">
                   {/* Cadences Card */}
                  <DealCadenceCard
                    dealId={deal.id}
                    contactId={deal.contact_id}
                    empresa={deal.pipeline_empresa ?? ''}
                  />

                  {/* Calls Panel */}
                  <DealCallsPanel dealId={deal.id} />

                  {/* Follow-up Hint */}
                  <FollowUpHintCard empresa={deal.pipeline_empresa} />

                  {/* Add activity inline */}
                  <Card>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select value={activityType} onValueChange={v => setActivityType(v as DealActivityType)}>
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(['NOTA', 'LIGACAO', 'EMAIL', 'REUNIAO', 'TAREFA'] as DealActivityType[]).map(t => (
                              <SelectItem key={t} value={t}>{ACTIVITY_LABELS[t]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleAddActivity} disabled={!activityText.trim() || addActivity.isPending}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)} title="Enviar email">
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        value={activityText}
                        onChange={e => setActivityText(e.target.value)}
                        placeholder="Descreva a atividade..."
                        className="min-h-[60px] text-sm"
                        rows={2}
                      />
                    </CardContent>
                  </Card>

                  {/* Activity feed */}
                  <div className="space-y-2 pb-4">
                    {activities?.map(a => (
                      <div key={a.id} className="flex gap-3 py-2 border-b border-border/40 last:border-0">
                        <span className="text-base mt-0.5">{ACTIVITY_ICONS[a.tipo]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{ACTIVITY_LABELS[a.tipo]}</span>
                            <span className="text-[10px] text-muted-foreground">{formatDate(a.created_at)}</span>
                            {a.user_nome && <span className="text-[10px] text-muted-foreground">· {a.user_nome}</span>}
                          </div>
                          {a.tipo === 'TAREFA' ? (
                            <div className="flex items-center gap-2 mt-1">
                              <Checkbox
                                checked={a.tarefa_concluida}
                                onCheckedChange={checked => dealId && toggleTask.mutate({ id: a.id, concluida: !!checked, dealId })}
                              />
                              <span className={`text-sm ${a.tarefa_concluida ? 'line-through text-muted-foreground' : ''}`}>
                                {a.descricao}
                              </span>
                            </div>
                          ) : (
                            <>
                              {a.descricao && <p className="text-sm text-muted-foreground mt-0.5">{a.descricao}</p>}
                              {/* Sprint 2: Show extracted data from SDR IA auto-creation */}
                              {a.tipo === 'CRIACAO' && (() => {
                                const meta = a.metadata as unknown as DealActivityMetadata | null;
                                if (!meta?.origem || meta.origem !== 'SDR_IA' || !meta.dados_extraidos) return null;
                                return (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {meta.dados_extraidos.necessidade_principal && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        📋 {meta.dados_extraidos.necessidade_principal}
                                      </Badge>
                                    )}
                                    {meta.dados_extraidos.valor_mencionado && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        💰 R$ {Number(meta.dados_extraidos.valor_mencionado).toLocaleString('pt-BR')}
                                      </Badge>
                                    )}
                                    {meta.dados_extraidos.urgencia && (
                                      <Badge variant="outline" className="text-[10px]">
                                        ⚡ {meta.dados_extraidos.urgencia}
                                      </Badge>
                                    )}
                                    {meta.dados_extraidos.decisor_identificado && (
                                      <Badge variant="outline" className="text-[10px]">✅ Decisor</Badge>
                                    )}
                                    {meta.dados_extraidos.prazo_mencionado && (
                                      <Badge variant="outline" className="text-[10px]">
                                        📅 {meta.dados_extraidos.prazo_mencionado}
                                      </Badge>
                                    )}
                                    <Badge variant="default" className="text-[10px]">🤖 SDR IA</Badge>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!activities || activities.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
                    )}
                  </div>
                </TabsContent>

                {/* Dados */}
                <TabsContent value="dados" className="px-6 mt-3 space-y-1">
                  {renderInlineField('Título', 'titulo', deal.titulo)}
                  {renderInlineField('Valor', 'valor', String(deal.valor ?? 0))}
                  {renderInlineField('Contato', 'contact_nome', deal.contact_nome)}
                  {renderInlineField('Organização', 'org_nome', deal.org_nome)}
                  {renderInlineField('Responsável', 'owner_nome', deal.owner_nome)}
                  {renderInlineField('Temperatura', 'temperatura', deal.temperatura)}
                  {renderInlineField('Canal de origem', 'canal_origem', deal.canal_origem)}
                  {renderInlineField('Notas', 'notas', deal.notas)}
                  {renderInlineField('Etiqueta', 'etiqueta', deal.etiqueta)}
                  <DealTagsEditor dealId={deal.id} tags={(deal as unknown as { tags?: string[] }).tags ?? []} />
                  {deal.data_previsao_fechamento && (
                    <div className="py-2 px-2">
                      <span className="text-xs text-muted-foreground">Previsão de fechamento</span>
                      <p className="text-sm">{new Date(deal.data_previsao_fechamento).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Campos Custom */}
                <TabsContent value="campos" className="px-6 mt-3">
                  <CustomFieldsRenderer
                    fields={resolvedFields}
                    entityType="DEAL"
                    entityId={dealId!}
                  />
                </TabsContent>

                {/* IA Insights (upgraded Scores tab) */}
                <TabsContent value="insights" className="px-6 mt-3 space-y-4 overflow-y-auto pb-4">
                  <InsightsTab deal={deal} dealId={dealId!} />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-12">Deal não encontrado.</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Email dialog */}
      {deal && (
        <EmailFromDealDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          dealId={deal.id}
          contactEmail={deal.contact_email ?? null}
          contactNome={deal.contact_nome ?? null}
        />
      )}

      {/* Loss dialog */}
      <Dialog open={lossOpen} onOpenChange={setLossOpen}>
        <DialogContent onClick={e => e.stopPropagation()}>
          <DialogHeader><DialogTitle>Motivo da Perda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={lossCategoria} onValueChange={setLossCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {lossCategories.map(c => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea value={lossMotivo} onChange={e => setLossMotivo(e.target.value)} placeholder="Motivo da perda..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmLoss} disabled={closeDeal.isPending}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
