import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCadenciasCRM,
  useCadenceStageTriggers,
  useCreateStageTrigger,
  useDeleteStageTrigger,
} from '@/hooks/useCadenciasCRM';
import { usePipelines } from '@/hooks/usePipelines';
import { useDealPipelineStages } from '@/hooks/useDealDetail';

export default function CadenciasPage() {
  const { data: cadencias, isLoading } = useCadenciasCRM();
  const { data: pipelines } = usePipelines();

  const [triggerOpen, setTriggerOpen] = useState(false);
  const [selPipeline, setSelPipeline] = useState('');
  const [selStage, setSelStage] = useState('');
  const [selCadence, setSelCadence] = useState('');
  const [selType, setSelType] = useState('STAGE_ENTER');

  const { data: stages } = useDealPipelineStages(selPipeline || null);
  const { data: triggers } = useCadenceStageTriggers(selPipeline || null);
  const createTrigger = useCreateStageTrigger();
  const deleteTrigger = useDeleteStageTrigger();

  // For listing all triggers across pipelines, load from first pipeline or selected
  const [viewPipeline, setViewPipeline] = useState('');
  const { data: viewTriggers } = useCadenceStageTriggers(viewPipeline || null);
  const { data: viewStages } = useDealPipelineStages(viewPipeline || null);

  const handleCreateTrigger = () => {
    if (!selPipeline || !selStage || !selCadence) {
      toast.error('Preencha todos os campos');
      return;
    }
    createTrigger.mutate(
      { pipeline_id: selPipeline, stage_id: selStage, cadence_id: selCadence, trigger_type: selType },
      {
        onSuccess: () => {
          toast.success('Trigger criado');
          setTriggerOpen(false);
          setSelStage('');
          setSelCadence('');
        },
        onError: (e: any) => toast.error(e?.message || 'Erro ao criar trigger'),
      }
    );
  };

  const getStageName = (stageId: string) => viewStages?.find(s => s.id === stageId)?.nome ?? stageId;
  const getCadenceName = (cadenceId: string) => cadencias?.find(c => c.id === cadenceId)?.nome ?? cadenceId;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cadências CRM</h1>
          <p className="text-muted-foreground text-sm">Gerencie cadências vinculadas a deals e configure triggers automáticos</p>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : (
          <>
            {/* Cadences grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cadencias?.map(c => (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        {c.nome}
                      </CardTitle>
                      <Badge variant={c.ativo ? 'default' : 'secondary'} className="text-[10px]">
                        {c.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{c.total_steps}</p>
                        <p className="text-[10px] text-muted-foreground">Steps</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-primary">{c.deals_ativos}</p>
                        <p className="text-[10px] text-muted-foreground">Ativos</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-success">{c.deals_completados}</p>
                        <p className="text-[10px] text-muted-foreground">Concluídos</p>
                      </div>
                    </div>
                    {c.triggers && c.triggers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.triggers.map(t => (
                          <Badge key={t.id} variant="outline" className="text-[10px]">
                            <ArrowRightLeft className="h-2.5 w-2.5 mr-1" />
                            {t.trigger_type === 'STAGE_ENTER' ? 'Entrada' : 'Saída'}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{c.empresa} · {c.canal_principal}</p>
                  </CardContent>
                </Card>
              ))}
              {(!cadencias || cadencias.length === 0) && (
                <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhuma cadência encontrada.</p>
              )}
            </div>

            {/* Triggers section */}
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Triggers Automáticos</h2>
                <Button size="sm" onClick={() => setTriggerOpen(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Novo Trigger
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm">Pipeline:</Label>
                <Select value={viewPipeline} onValueChange={setViewPipeline}>
                  <SelectTrigger className="w-64 h-8 text-xs">
                    <SelectValue placeholder="Selecione um pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} ({p.empresa})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {viewPipeline && viewTriggers && viewTriggers.length > 0 ? (
                <div className="space-y-2">
                  {viewTriggers.map(t => (
                    <div key={t.id} className="flex items-center justify-between border rounded-md p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {t.trigger_type === 'STAGE_ENTER' ? '→ Entrada' : '← Saída'}
                        </Badge>
                        <span className="text-sm">{getStageName(t.stage_id)}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm font-medium">{getCadenceName(t.cadence_id)}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteTrigger.mutate(t.id, { onSuccess: () => toast.success('Trigger removido') })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : viewPipeline ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum trigger configurado para este pipeline.</p>
              ) : null}
            </div>
          </>
        )}

        {/* Create trigger dialog */}
        <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Trigger Automático</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pipeline</Label>
                <Select value={selPipeline} onValueChange={v => { setSelPipeline(v); setSelStage(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {pipelines?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} ({p.empresa})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estágio</Label>
                <Select value={selStage} onValueChange={setSelStage} disabled={!selPipeline}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stages?.filter(s => !s.is_won && !s.is_lost).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cadência</Label>
                <Select value={selCadence} onValueChange={setSelCadence}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {cadencias?.filter(c => c.ativo).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={selType} onValueChange={setSelType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAGE_ENTER">Entrada no Estágio</SelectItem>
                    <SelectItem value="STAGE_EXIT">Saída do Estágio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTriggerOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateTrigger} disabled={createTrigger.isPending}>Criar Trigger</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
