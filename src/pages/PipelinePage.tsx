import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePipelines } from '@/hooks/usePipelines';
import { useDeals, useKanbanData } from '@/hooks/useDeals';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { PipelineFilters } from '@/components/pipeline/PipelineFilters';
import { PipelineListView } from '@/components/pipeline/PipelineListView';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { CreateDealDialog } from '@/components/pipeline/CreateDealDialog';
import { DealDetailSheet } from '@/components/deals/DealDetailSheet';
import { TransferDealsDialog } from '@/components/pipeline/TransferDealsDialog';
import { Kanban } from 'lucide-react';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTokenizaOffers } from '@/hooks/useTokenizaOffers';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';
import type { AdvancedFilterState } from '@/types/filterCondition';

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

const PIPELINE_STORAGE_PREFIX = 'bluecrm-last-pipeline-';

const EMPTY_ADVANCED: AdvancedFilterState = { matchMode: 'all', conditions: [] };

function PipelineContent() {
  const { trackPageView } = useAnalyticsEvents();
  
  useEffect(() => {
    trackPageView('pipeline');
  }, [trackPageView]);

  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: owners = [] } = useOwnerOptions();
  const { activeOffers } = useActiveTokenizaOffers();
  const { data: isVendedor = false } = useCurrentUserIsVendedor();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [temperatura, setTemperatura] = useState('all');
  const [ownerId, setOwnerId] = useState('all');
  const [tag, setTag] = useState('all');
  const [etiquetaIA, setEtiquetaIA] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const dealFromUrl = searchParams.get('deal');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(dealFromUrl);
  const [showTransfer, setShowTransfer] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    return (localStorage.getItem('bluecrm-pipeline-view') as 'kanban' | 'list') || 'kanban';
  });
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>(EMPTY_ADVANCED);
  const [iaSort, setIaSort] = useState(() => {
    try { return localStorage.getItem('kanban_ia_sort') === 'true'; } catch { return false; }
  });

  const toggleIaSort = useCallback(() => {
    setIaSort(prev => {
      const next = !prev;
      try { localStorage.setItem('kanban_ia_sort', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const handleViewModeChange = (m: 'kanban' | 'list') => {
    setViewMode(m);
    localStorage.setItem('bluecrm-pipeline-view', m);
  };

  const handleDealClick = (dealId: string) => {
    setSelectedDealId(dealId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('deal', dealId);
      return next;
    }, { replace: true });
  };

  const handleDealClose = (open: boolean) => {
    if (!open) {
      setSelectedDealId(null);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('deal');
        return next;
      }, { replace: true });
    }
  };

  useEffect(() => {
    const dealParam = searchParams.get('deal');
    if (dealParam && dealParam !== selectedDealId) {
      setSelectedDealId(dealParam);
    }
  }, [searchParams]);

  const availableTags = useMemo(() => activeOffers.map(o => o.nome), [activeOffers]);

  const effectiveOwnerId = (isVendedor && !isAdmin && user?.id) ? user.id : ownerId;
  const ownerFilterDisabled = isVendedor && !isAdmin;

  const handlePipelineChange = (id: string) => {
    setSelectedPipelineId(id);
    localStorage.setItem(`${PIPELINE_STORAGE_PREFIX}${activeCompany}`, id);
  };

  useEffect(() => {
    if (pipelines && pipelines.length > 0) {
      const savedId = localStorage.getItem(`${PIPELINE_STORAGE_PREFIX}${activeCompany}`);
      const savedPipeline = savedId ? pipelines.find(p => p.id === savedId) : null;
      const fallback = pipelines.find(p => p.is_default) ?? pipelines[0];
      setSelectedPipelineId(savedPipeline?.id ?? fallback.id);
    } else {
      setSelectedPipelineId(null);
    }
  }, [pipelines, activeCompany]);

  useEffect(() => {
    setTemperatura('all');
    setTag('all');
    setAdvancedFilters(EMPTY_ADVANCED);
  }, [activeCompany]);

  const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId);

  const hasAdvanced = advancedFilters.conditions.length > 0;

  const { data: dealsData, isLoading: dealsLoading } = useDeals({
    pipelineId: selectedPipelineId,
    ownerId: !hasAdvanced && effectiveOwnerId !== 'all' ? effectiveOwnerId : undefined,
    temperatura: !hasAdvanced && temperatura !== 'all' ? temperatura : undefined,
    tag: !hasAdvanced && tag !== 'all' ? tag : undefined,
    etiqueta: !hasAdvanced && etiquetaIA ? 'Atendimento IA' : undefined,
    page: -1,
    advancedFilters: hasAdvanced ? advancedFilters : null,
  });
  
  const deals = dealsData?.data;

  const { columns, wonLost } = useKanbanData(deals, selectedPipeline?.pipeline_stages);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-x-hidden overflow-y-hidden p-4 md:p-6 gap-5 max-h-full">
      <div className="flex items-center gap-3">
        <Kanban className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Pipeline</h1>
      </div>

      {pipelinesLoading ? (
        <div className="text-sm text-muted-foreground p-6">Carregando pipelines...</div>
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
            onPipelineChange={handlePipelineChange}
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
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            stages={selectedPipeline?.pipeline_stages ?? []}
            advancedFilters={advancedFilters}
            onAdvancedFiltersApply={setAdvancedFilters}
            onAdvancedFiltersClear={() => setAdvancedFilters(EMPTY_ADVANCED)}
          />

          <div className="border-b border-border/50 mt-2" />

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-4">
            {viewMode === 'kanban' ? (
              <KanbanBoard
                columns={columns}
                wonLost={wonLost}
                isLoading={dealsLoading}
                onDealClick={handleDealClick}
                onTransferClick={() => setShowTransfer(true)}
              />
            ) : (
              <PipelineListView
                deals={deals ?? []}
                stages={selectedPipeline?.pipeline_stages ?? []}
                owners={owners}
                isLoading={dealsLoading}
                onDealClick={handleDealClick}
              />
            )}
          </div>

          <TransferDealsDialog
            open={showTransfer}
            onOpenChange={setShowTransfer}
            deals={deals ?? []}
            owners={owners}
          />

          <DealDetailSheet
            dealId={selectedDealId}
            open={!!selectedDealId}
            onOpenChange={handleDealClose}
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
