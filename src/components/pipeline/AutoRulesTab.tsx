import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, ArrowRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { usePipelines } from '@/hooks/usePipelines';
import { useAutoRules, useCreateAutoRule, useUpdateAutoRule, useDeleteAutoRule } from '@/hooks/useAutoRules';

const TRIGGER_LABELS: Record<string, string> = {
  ATIVIDADE_CRIADA: 'Atividade Criada',
  SLA_ESTOURADO: 'SLA Estourado',
  SCORE_THRESHOLD: 'Score Threshold',
};

const ACTIVITY_TYPES = ['NOTA', 'LIGACAO', 'EMAIL', 'REUNIAO', 'TAREFA'];

export function AutoRulesTab() {
  const { data: rules, isLoading } = useAutoRules();
  const { data: pipelines } = usePipelines();
  const createRule = useCreateAutoRule();
  const updateRule = useUpdateAutoRule();
  const deleteRule = useDeleteAutoRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selPipeline, setSelPipeline] = useState('');
  const [selFrom, setSelFrom] = useState('');
  const [selTo, setSelTo] = useState('');
  const [selTrigger, setSelTrigger] = useState('');
  const [triggerActivityType, setTriggerActivityType] = useState('');
  const [triggerScoreValue, setTriggerScoreValue] = useState('');

  const selectedPipelineObj = pipelines?.find(p => p.id === selPipeline);
  const stagesForPipeline = selectedPipelineObj?.pipeline_stages ?? [];

  const resetForm = () => {
    setSelPipeline('');
    setSelFrom('');
    setSelTo('');
    setSelTrigger('');
    setTriggerActivityType('');
    setTriggerScoreValue('');
  };

  const handleCreate = async () => {
    if (!selPipeline || !selFrom || !selTo || !selTrigger) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (selFrom === selTo) {
      toast.error('Stage origem e destino devem ser diferentes');
      return;
    }

    let trigger_config: Record<string, unknown> = {};
    if (selTrigger === 'ATIVIDADE_CRIADA') {
      if (!triggerActivityType) { toast.error('Selecione o tipo de atividade'); return; }
      trigger_config = { tipo_atividade: triggerActivityType };
    } else if (selTrigger === 'SCORE_THRESHOLD') {
      const v = parseInt(triggerScoreValue, 10);
      if (isNaN(v) || v < 0 || v > 100) { toast.error('Score deve ser entre 0 e 100'); return; }
      trigger_config = { score_minimo: v };
    }

    const empresa = selectedPipelineObj?.empresa ?? 'BLUE';

    try {
      await createRule.mutateAsync({
        pipeline_id: selPipeline,
        empresa,
        from_stage_id: selFrom,
        to_stage_id: selTo,
        trigger_type: selTrigger,
        trigger_config,
      });
      toast.success('Regra criada');
      resetForm();
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updateRule.mutateAsync({ id, is_active: active });
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast.success('Regra excluída');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  // Group rules by pipeline
  const grouped = (rules ?? []).reduce<Record<string, typeof rules>>((acc, r) => {
    const key = r.pipeline_nome ?? r.pipeline_id;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(r);
    return acc;
  }, {});

  if (isLoading) return <div className="text-muted-foreground p-4">Carregando regras...</div>;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Configure regras para mover deals automaticamente entre estágios.
          </p>
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Regra</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Nova Regra Automática</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Pipeline</Label>
                  <Select value={selPipeline} onValueChange={v => { setSelPipeline(v); setSelFrom(''); setSelTo(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(pipelines ?? []).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Stage Origem</Label>
                    <Select value={selFrom} onValueChange={setSelFrom} disabled={!selPipeline}>
                      <SelectTrigger><SelectValue placeholder="De..." /></SelectTrigger>
                      <SelectContent>
                        {stagesForPipeline.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Stage Destino</Label>
                    <Select value={selTo} onValueChange={setSelTo} disabled={!selPipeline}>
                      <SelectTrigger><SelectValue placeholder="Para..." /></SelectTrigger>
                      <SelectContent>
                        {stagesForPipeline.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Gatilho</Label>
                  <Select value={selTrigger} onValueChange={setSelTrigger}>
                    <SelectTrigger><SelectValue placeholder="Tipo de gatilho..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selTrigger === 'ATIVIDADE_CRIADA' && (
                  <div>
                    <Label>Tipo de Atividade</Label>
                    <Select value={triggerActivityType} onValueChange={setTriggerActivityType}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selTrigger === 'SCORE_THRESHOLD' && (
                  <div>
                    <Label>Score mínimo (0-100)</Label>
                    <Input
                      type="number" min={0} max={100}
                      value={triggerScoreValue}
                      onChange={e => setTriggerScoreValue(e.target.value)}
                      placeholder="Ex: 75"
                    />
                  </div>
                )}

                <Button onClick={handleCreate} className="w-full" disabled={createRule.isPending}>
                  Criar Regra
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {Object.keys(grouped).length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma regra automática configurada.</p>
            </CardContent>
          </Card>
        )}

        {Object.entries(grouped).map(([pipelineName, pRules]) => (
          <Card key={pipelineName}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{pipelineName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pRules!.map(rule => (
                <div key={rule.id} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                  <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium truncate">{rule.from_stage_nome ?? '?'}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{rule.to_stage_nome ?? '?'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}
                      </Badge>
                      {rule.trigger_type === 'ATIVIDADE_CRIADA' && rule.trigger_config?.tipo_atividade && (
                        <Badge variant="secondary" className="text-xs">
                          {String(rule.trigger_config.tipo_atividade)}
                        </Badge>
                      )}
                      {rule.trigger_type === 'SCORE_THRESHOLD' && rule.trigger_config?.score_minimo != null && (
                        <Badge variant="secondary" className="text-xs">
                          ≥ {String(rule.trigger_config.score_minimo)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={v => handleToggle(rule.id, v)}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{rule.is_active ? 'Desativar' : 'Ativar'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir regra</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
