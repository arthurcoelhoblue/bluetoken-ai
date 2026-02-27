import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Plus, Trash2, GripVertical, Clock, Zap } from 'lucide-react';
import { AutoRulesTab } from '@/components/pipeline/AutoRulesTab';
import { usePipelines } from '@/hooks/usePipelines';
import { useCreatePipeline, useUpdatePipeline, useDeletePipeline, useCreateStage, useUpdateStage, useDeleteStage, useDuplicatePipeline } from '@/hooks/usePipelineConfig';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PipelineStage } from '@/types/deal';

function PipelineConfigContent() {
  const { empresaRecords } = useCompany();
  const { data: pipelines, isLoading } = usePipelines();
  const { data: deals } = useQuery({
    queryKey: ['deals_existence_check'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('pipeline_id').limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();
  const duplicatePipeline = useDuplicatePipeline();
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmpresa, setNewEmpresa] = useState(empresaRecords[0]?.id ?? 'BLUE');
  const [newTipo, setNewTipo] = useState('COMERCIAL');
  const [cloneFromId, setCloneFromId] = useState<string | null>(null);
  const [newStageDialogOpen, setNewStageDialogOpen] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');

  const pipelineHasDeals = (pipelineId: string) => {
    return (deals ?? []).some(d => d.pipeline_id === pipelineId);
  };

  const handleCreatePipeline = async () => {
    if (!newName.trim()) return;
    try {
      if (cloneFromId) {
        await duplicatePipeline.mutateAsync({ sourceId: cloneFromId, newName: newName.trim(), newEmpresa: newEmpresa as any });
      } else {
        await createPipeline.mutateAsync({ nome: newName.trim(), empresa: newEmpresa as any, tipo: newTipo });
      }
      toast.success(cloneFromId ? 'Pipeline clonado com sucesso' : 'Pipeline criado');
      setNewName('');
      setCloneFromId(null);
      setNewDialogOpen(false);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleDeletePipeline = async (id: string) => {
    if (pipelineHasDeals(id)) {
      toast.error('Pipeline com deals vinculados não pode ser excluído');
      return;
    }
    try {
      await deletePipeline.mutateAsync(id);
      toast.success('Pipeline excluído');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleAddStage = async (pipelineId: string) => {
    if (!newStageName.trim()) return;
    const pipeline = pipelines?.find(p => p.id === pipelineId);
    const maxPos = Math.max(0, ...(pipeline?.pipeline_stages?.map(s => s.posicao) ?? []));
    try {
      await createStage.mutateAsync({
        pipeline_id: pipelineId,
        nome: newStageName.trim(),
        posicao: maxPos + 1,
      });
      toast.success('Stage adicionado');
      setNewStageName('');
      setNewStageDialogOpen(null);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleUpdateTempoMinimo = async (stage: PipelineStage, value: string) => {
    const parsed = value === '' ? null : parseInt(value, 10);
    if (parsed !== null && isNaN(parsed)) return;
    try {
      await updateStage.mutateAsync({ id: stage.id, tempo_minimo_dias: parsed } as Record<string, unknown> & { id: string });
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Novo Funil</Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Criar novo pipeline</TooltipContent>
            </Tooltip>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Pipeline</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome do funil" value={newName} onChange={e => setNewName(e.target.value)} />
                <Select value={newEmpresa} onValueChange={setNewEmpresa}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {empresaRecords.filter(e => e.is_active).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newTipo} onValueChange={setNewTipo}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMERCIAL">Comercial</SelectItem>
                    <SelectItem value="RENOVACAO">Renovação</SelectItem>
                    <SelectItem value="POS_VENDA">Pós-Venda</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={cloneFromId ?? '_none'} onValueChange={v => setCloneFromId(v === '_none' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Clonar de (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum (vazio)</SelectItem>
                    {(pipelines ?? []).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} ({p.empresa})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleCreatePipeline} className="w-full" disabled={createPipeline.isPending || duplicatePipeline.isPending}>Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {(pipelines ?? []).map(pipeline => (
          <Collapsible key={pipeline.id} defaultOpen>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-3 cursor-pointer hover:opacity-80">
                    <CardTitle className="text-lg">{pipeline.nome}</CardTitle>
                    <Badge variant="outline">{pipeline.empresa}</Badge>
                    {(pipeline as unknown as { tipo?: string }).tipo && (pipeline as unknown as { tipo?: string }).tipo !== 'COMERCIAL' && (
                      <Badge variant="secondary">{(pipeline as unknown as { tipo?: string }).tipo}</Badge>
                    )}
                    {pipeline.is_default && <Badge variant="secondary">Padrão</Badge>}
                  </CollapsibleTrigger>
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleDeletePipeline(pipeline.id)}
                          disabled={pipelineHasDeals(pipeline.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{pipelineHasDeals(pipeline.id) ? 'Tem deals vinculados' : 'Excluir pipeline'}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-2">
                    {pipeline.pipeline_stages.map(stage => (
                      <div key={stage.id} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: stage.cor }} />
                        <span className="flex-1 text-sm font-medium">{stage.nome}</span>
                        <span className="text-xs text-muted-foreground">#{stage.posicao}</span>
                        {stage.sla_minutos && (
                          <Badge variant="outline" className="text-xs">SLA {stage.sla_minutos}min</Badge>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                type="number"
                                min={0}
                                className="h-7 w-20 text-xs"
                                placeholder="dias"
                                defaultValue={(stage as unknown as { tempo_minimo_dias?: number | null }).tempo_minimo_dias ?? ''}
                                onBlur={e => handleUpdateTempoMinimo(stage, e.target.value)}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Tempo mínimo (dias) para perder deal neste stage</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={async () => {
                                try {
                                  await deleteStage.mutateAsync(stage.id);
                                  toast.success('Stage removido');
                                } catch (e: unknown) { toast.error((e as Error).message); }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir stage</TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>

                  <Dialog open={newStageDialogOpen === pipeline.id} onOpenChange={open => setNewStageDialogOpen(open ? pipeline.id : null)}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="mt-3">
                            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Stage
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Adicionar novo stage ao pipeline</TooltipContent>
                    </Tooltip>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Novo Stage</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <Input placeholder="Nome do stage" value={newStageName} onChange={e => setNewStageName(e.target.value)} />
                        <Button onClick={() => handleAddStage(pipeline.id)} className="w-full">Adicionar</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </TooltipProvider>
  );
}

export default function PipelineConfigPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Settings}
        title="Configuração de Funis"
        description="Gerencie pipelines e stages do CRM."
      />
      <div className="px-6 pb-8">
        <Tabs defaultValue="funis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="funis">
              <Settings className="h-3.5 w-3.5 mr-1.5" />Funis e Stages
            </TabsTrigger>
            <TabsTrigger value="regras">
              <Zap className="h-3.5 w-3.5 mr-1.5" />Regras Automáticas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="funis">
            <PipelineConfigContent />
          </TabsContent>
          <TabsContent value="regras">
            <AutoRulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
