import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePipelines } from '@/hooks/usePipelines';
import { useDeals, useKanbanData } from '@/hooks/useDeals';
import { useCompany } from '@/contexts/CompanyContext';
import { PipelineFilters } from '@/components/pipeline/PipelineFilters';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { CreateDealDialog } from '@/components/pipeline/CreateDealDialog';
import { DealDetailSheet } from '@/components/deals/DealDetailSheet';
import { Kanban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

function useOwnerOptions() {
  return useQuery({
    queryKey: ['pipeline-owners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('is_active', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(p => ({ id: p.id, nome: p.nome || p.id }));
    },
  });
}

function PipelineContent() {
  const { activeCompany } = useCompany();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: owners = [] } = useOwnerOptions();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [temperatura, setTemperatura] = useState('all');
  const [ownerId, setOwnerId] = useState('all');
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  useEffect(() => {
    if (pipelines && pipelines.length > 0) {
      const defaultPipeline = pipelines.find(p => p.is_default) ?? pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    } else {
      setSelectedPipelineId(null);
    }
  }, [pipelines]);

  useEffect(() => {
    setSelectedPipelineId(null);
    setTemperatura('all');
  }, [activeCompany]);

  const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId);

  const { data: deals, isLoading: dealsLoading } = useDeals({
    pipelineId: selectedPipelineId,
    ownerId: ownerId !== 'all' ? ownerId : undefined,
    temperatura: temperatura !== 'all' ? temperatura : undefined,
  });

  const { columns, wonLost } = useKanbanData(deals, selectedPipeline?.pipeline_stages);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-4 md:p-6 gap-4">
      <div className="flex items-center gap-3">
        <Kanban className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Pipeline</h1>
      </div>

      {pipelinesLoading ? (
        <div className="text-sm text-muted-foreground">Carregando pipelines...</div>
      ) : !pipelines || pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-2">
          <Kanban className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum pipeline encontrado para esta empresa.</p>
        </div>
      ) : (
        <>
          <PipelineFilters
            pipelines={pipelines}
            selectedPipelineId={selectedPipelineId}
            onPipelineChange={setSelectedPipelineId}
            temperatura={temperatura}
            onTemperaturaChange={setTemperatura}
            ownerId={ownerId}
            onOwnerChange={setOwnerId}
            owners={owners}
            onNewDeal={() => setShowCreateDeal(true)}
          />

          <div className="flex-1 min-h-0 flex flex-col">
            <KanbanBoard
              columns={columns}
              wonLost={wonLost}
              isLoading={dealsLoading}
              onDealClick={setSelectedDealId}
            />
          </div>

          <DealDetailSheet
            dealId={selectedDealId}
            open={!!selectedDealId}
            onOpenChange={open => !open && setSelectedDealId(null)}
          />

          {selectedPipeline && (
            <CreateDealDialog
              open={showCreateDeal}
              onOpenChange={setShowCreateDeal}
              pipelineId={selectedPipeline.id}
              stages={selectedPipeline.pipeline_stages}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function PipelinePage() {
  return (
    <AppLayout>
      <PipelineContent />
    </AppLayout>
  );
}
