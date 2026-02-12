import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Settings, Plus, Copy, Trash2, GripVertical, Trophy, XCircle } from 'lucide-react';
import { usePipelines } from '@/hooks/usePipelines';
import { useCreatePipeline, useUpdatePipeline, useDeletePipeline, useCreateStage, useUpdateStage, useDeleteStage } from '@/hooks/usePipelineConfig';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmpresa, setNewEmpresa] = useState<'BLUE' | 'TOKENIZA'>('BLUE');
  const [newStageDialogOpen, setNewStageDialogOpen] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');

  const pipelineHasDeals = (pipelineId: string) => {
    return (deals ?? []).some(d => d.pipeline_id === pipelineId);
  };

  const handleCreatePipeline = async () => {
    if (!newName.trim()) return;
    try {
      await createPipeline.mutateAsync({ nome: newName.trim(), empresa: newEmpresa });
      toast.success('Pipeline criado');
      setNewName('');
      setNewDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
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
    } catch (e: any) {
      toast.error(e.message);
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleStageFlag = async (stage: PipelineStage, flag: 'is_won' | 'is_lost') => {
    try {
      const update = flag === 'is_won'
        ? { is_won: !stage.is_won, is_lost: false }
        : { is_lost: !stage.is_lost, is_won: false };
      await updateStage.mutateAsync({ id: stage.id, ...update } as any);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Funil</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Pipeline</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome do funil" value={newName} onChange={e => setNewName(e.target.value)} />
              <Select value={newEmpresa} onValueChange={v => setNewEmpresa(v as 'BLUE' | 'TOKENIZA')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BLUE">Blue</SelectItem>
                  <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreatePipeline} className="w-full" disabled={createPipeline.isPending}>Criar</Button>
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
                      <Button
                        variant={stage.is_won ? 'default' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleToggleStageFlag(stage, 'is_won')}
                        title="Marcar como Won"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={stage.is_lost ? 'destructive' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleToggleStageFlag(stage, 'is_lost')}
                        title="Marcar como Lost"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={async () => {
                          try {
                            await deleteStage.mutateAsync(stage.id);
                            toast.success('Stage removido');
                          } catch (e: any) { toast.error(e.message); }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Dialog open={newStageDialogOpen === pipeline.id} onOpenChange={open => setNewStageDialogOpen(open ? pipeline.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-3">
                      <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Stage
                    </Button>
                  </DialogTrigger>
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
  );
}

export default function PipelineConfigPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Settings}
        title="Configuração de Funis"
        description="Gerencie pipelines e stages do CRM."
        patchInfo="Patch 2 — Pipelines Reais"
      />
      <div className="px-6 pb-8">
        <PipelineConfigContent />
      </div>
    </AppLayout>
  );
}
