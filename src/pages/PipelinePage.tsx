import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePipelines } from '@/hooks/usePipelines';
import { useDeals, useKanbanData } from '@/hooks/useDeals';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { PipelineFilters } from '@/components/pipeline/PipelineFilters';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { CreateDealDialog } from '@/components/pipeline/CreateDealDialog';
import { DealDetailSheet } from '@/components/deals/DealDetailSheet';
import { Kanban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTokenizaOffers } from '@/hooks/useTokenizaOffers';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';

function useOwnerOptions() {
  return useQuery({
    queryKey: ['pipeline-owners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('is_active', true)
        .eq('is_vendedor', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(p => ({ id: p.id, nome: p.nome || p.id }));
    },
  });
}

function useCurrentUserIsVendedor() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['current-user-is-vendedor', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_vendedor')
        .eq('id', user!.id)
        .single();
      return data?.is_vendedor ?? false;
    },
  });
}

function PipelineContent() {
  const { trackPageView } = useAnalyticsEvents();
  
  useEffect(() => {
    trackPageView('pipeline');
  }, [trackPageView]);

  const { activeCompany } = useCompany();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes('ADMIN');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: owners = [] } = useOwnerOptions();
  const { activeOffers } = useActiveTokenizaOffers();
  const { data: isVendedor = false } = useCurrentUserIsVendedor();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [temperatura, setTemperatura] = useState('all');
  // For vendedores, force owner filter to themselves
  const [ownerId, setOwnerId] = useState('all');
  const [tag, setTag] = useState('all');
  const [etiquetaIA, setEtiquetaIA] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const dealFromUrl = searchParams.get('deal');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(dealFromUrl);

  // Auto-open deal from query param when navigating from insights
  useEffect(() => {
    const dealParam = searchParams.get('deal');
    if (dealParam && dealParam !== selectedDealId) {
      setSelectedDealId(dealParam);
    }
  }, [searchParams]);

  const availableTags = useMemo(() => activeOffers.map(o => o.nome), [activeOffers]);

  // Vendedores: force filter to self
  const effectiveOwnerId = (isVendedor && !isAdmin && user?.id) ? user.id : ownerId;
  const ownerFilterDisabled = isVendedor && !isAdmin;

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
    setTag('all');
  }, [activeCompany]);

  const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId);

  const { data: dealsData, isLoading: dealsLoading } = useDeals({
    pipelineId: selectedPipelineId,
    ownerId: effectiveOwnerId !== 'all' ? effectiveOwnerId : undefined,
    temperatura: temperatura !== 'all' ? temperatura : undefined,
    tag: tag !== 'all' ? tag : undefined,
    etiqueta: etiquetaIA ? 'Atendimento IA' : undefined,
    page: -1, // Fetch all (up to 500) for Kanban
  });
  
  const deals = dealsData?.data;

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
            ownerId={effectiveOwnerId}
            onOwnerChange={ownerFilterDisabled ? () => {} : setOwnerId}
            owners={owners}
            onNewDeal={() => setShowCreateDeal(true)}
            tag={tag}
            onTagChange={setTag}
            availableTags={availableTags}
            ownerDisabled={ownerFilterDisabled}
            etiquetaIA={etiquetaIA}
            onEtiquetaIAChange={setEtiquetaIA}
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
