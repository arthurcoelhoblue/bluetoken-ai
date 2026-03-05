import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Sparkles, Package, Video } from 'lucide-react';
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
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { supabase } from '@/integrations/supabase/client';
import { CustomFieldsRenderer } from '@/components/contacts/CustomFieldsRenderer';
import { EmailFromDealDialog } from '@/components/deals/EmailFromDealDialog';
import { InsightsTab } from '@/components/deals/DealInsightsTab';
import { DealDetailHeader } from '@/components/deals/DealDetailHeader';
import { DealTimelineTab } from '@/components/deals/DealTimelineTab';
import { DealDadosTab } from '@/components/deals/DealDadosTab';
import { DealLossDialog } from '@/components/deals/DealLossDialog';
import { DealProductsTab } from '@/components/deals/DealProductsTab';
import { DealMeetingsTab } from '@/components/deals/DealMeetingsTab';
import { ScheduleActivityDialog } from '@/components/deals/ScheduleActivityDialog';
import { ConversationPanel } from '@/components/conversas/ConversationPanel';
import type { DealActivityType } from '@/types/deal';

interface Props {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCHEDULABLE_ACTIVITY_TYPES: DealActivityType[] = ['TAREFA', 'LIGACAO', 'EMAIL', 'REUNIAO'];

export function DealDetailSheet({ dealId, open, onOpenChange }: Props) {
  const { data: deal, isLoading } = useDealDetail(dealId);
  const { data: activities } = useDealActivities(dealId);
  const { data: stages } = useDealPipelineStages(deal?.pipeline_id ?? null);
  const { data: lossCategories = [] } = useLossCategories();
  const resolvedFields = useResolvedFields('DEAL', dealId);

  const { data: contactBridge } = useQuery({
    queryKey: ['deal-contact-bridge', deal?.contact_id],
    enabled: !!deal?.contact_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, legacy_lead_id, empresa, telefone, nome')
        .eq('id', deal!.contact_id)
        .maybeSingle();
      return data;
    },
  });

  const hasChat = !!contactBridge?.telefone;

  const { data: chatMessages = [], isLoading: chatLoading, refetch: refetchChat, isFetching: chatFetching } = useConversationMessages({
    leadId: contactBridge?.legacy_lead_id ?? '',
    contactId: contactBridge?.id,
    empresa: contactBridge?.empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA' | undefined,
    telefone: contactBridge?.telefone,
    enabled: hasChat,
  });

  const addActivity = useAddDealActivity();
  const toggleTask = useToggleTaskActivity();
  const updateField = useUpdateDealField();
  const moveStage = useMoveDealStage();
  const closeDeal = useCloseDeal();
  const reopenDeal = useReopenDeal();

  const [lossOpen, setLossOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const isClosed = deal?.status === 'GANHO' || deal?.status === 'PERDIDO';
  const orderedStages = (stages ?? []).filter(s => !s.is_won && !s.is_lost).sort((a, b) => a.posicao - b.posicao);

  // Check if deal has a future schedulable activity (fix: compare date-only, include all schedulable types)
  const hasFutureActivity = useCallback(() => {
    if (!activities) return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    return activities.some(a =>
      SCHEDULABLE_ACTIVITY_TYPES.includes(a.tipo) &&
      !a.tarefa_concluida &&
      a.tarefa_prazo &&
      a.tarefa_prazo.slice(0, 10) >= todayStr
    );
  }, [activities]);

  // Intercept sheet close: if deal is open and has no future activity, prompt
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && deal && deal.status === 'ABERTO' && !hasFutureActivity()) {
      setScheduleOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  }, [deal, hasFutureActivity, onOpenChange]);

  const handleScheduleActivity = (tipo: DealActivityType, descricao: string, prazo: string) => {
    if (!dealId) return;
    addActivity.mutate({ deal_id: dealId, tipo, descricao, tarefa_prazo: prazo }, {
      onSuccess: () => {
        toast.success('Atividade agendada');
        onOpenChange(false);
      },
    });
  };

  const tabCount = 6 + (hasChat ? 1 : 0);

  const handleWin = () => {
    if (!deal) return;
    closeDeal.mutate({ dealId: deal.id, status: 'GANHO', stageId: deal.stage_id }, {
      onSuccess: () => toast.success('Deal marcado como ganho!'),
      onError: (err: Error) => toast.error(err.message || 'Erro ao marcar como ganho'),
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

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          className="w-[600px] sm:max-w-[600px] flex flex-col overflow-y-auto p-0"
          onPointerDownOutside={(e) => {
            const target = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null;
            if (target?.closest?.('[data-fab-widget]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            const target = ((e as any).detail?.originalEvent?.target ?? (e as any).target) as HTMLElement | null;
            if (target?.closest?.('[data-fab-widget]')) {
              e.preventDefault();
            }
          }}
        >
          {isLoading ? (
            <div className="space-y-4 p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-8 w-3/4" /><Skeleton className="h-48 w-full" /></div>
          ) : deal ? (
            <>
              <DealDetailHeader
                deal={deal}
                stages={stages ?? []}
                isClosed={isClosed}
                onWin={handleWin}
                onLose={() => setLossOpen(true)}
                onReopen={handleReopen}
                onStageClick={handleStageClick}
                legacyLeadId={contactBridge?.legacy_lead_id ?? null}
                leadEmpresa={contactBridge?.empresa ?? null}
                contactId={deal.contact_id ?? null}
                onClose={() => onOpenChange(false)}
              />

              <Tabs defaultValue="timeline" className="flex-1 flex flex-col">
                <TabsList className={`grid w-full mx-6 mt-3`} style={{ width: 'calc(100% - 3rem)', gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  {hasChat && (
                    <TabsTrigger value="chat" className="gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Chat
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="produtos" className="gap-1">
                    <Package className="h-3 w-3" />
                    Produtos
                  </TabsTrigger>
                  <TabsTrigger value="reunioes" className="gap-1">
                    <Video className="h-3 w-3" />
                    Reuniões
                  </TabsTrigger>
                  <TabsTrigger value="campos">Campos</TabsTrigger>
                  <TabsTrigger value="insights">
                    <Sparkles className="h-3 w-3 mr-1" />
                    IA
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline">
                  <DealTimelineTab
                    deal={deal}
                    dealId={dealId!}
                    activities={activities}
                    addActivity={addActivity}
                    toggleTask={toggleTask}
                    onOpenEmail={() => setEmailOpen(true)}
                  />
                </TabsContent>

                <TabsContent value="dados">
                  <DealDadosTab deal={deal} updateField={updateField} />
                </TabsContent>

                {hasChat && (
                  <TabsContent value="chat" className="px-6 mt-3 pb-4">
                    <ConversationPanel
                      leadId={contactBridge?.legacy_lead_id ?? ''}
                      empresa={contactBridge?.empresa ?? ''}
                      telefone={contactBridge?.telefone}
                      leadNome={contactBridge?.nome}
                      contactEmail={deal.contact_email}
                      contactId={deal.contact_id}
                      dealId={deal.id}
                      messages={chatMessages}
                      isLoading={chatLoading}
                      onRefresh={() => refetchChat()}
                      isRefreshing={chatFetching}
                      modo="MANUAL"
                      maxHeight="350px"
                    />
                  </TabsContent>
                )}

                <TabsContent value="produtos">
                  <DealProductsTab
                    dealId={dealId!}
                    pipelineEmpresa={deal.pipeline_empresa}
                    dealTitulo={deal.titulo}
                    contactNome={deal.contact_nome}
                    contactEmail={deal.contact_email}
                    organizationNome={deal.org_nome}
                  />
                </TabsContent>

                <TabsContent value="reunioes">
                  <DealMeetingsTab dealId={dealId!} />
                </TabsContent>

                <TabsContent value="campos" className="px-6 mt-3">
                  <CustomFieldsRenderer fields={resolvedFields} entityType="DEAL" entityId={dealId!} />
                </TabsContent>

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

      {deal && (
        <EmailFromDealDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          dealId={deal.id}
          contactEmail={deal.contact_email ?? null}
          contactNome={deal.contact_nome ?? null}
        />
      )}

      {deal && (
        <DealLossDialog
          open={lossOpen}
          onOpenChange={setLossOpen}
          dealId={deal.id}
          stageId={deal.stage_id}
          lossCategories={lossCategories}
          closeDeal={closeDeal}
        />
      )}

      <ScheduleActivityDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSchedule={handleScheduleActivity}
        onSkip={() => onOpenChange(false)}
      />
    </>
  );
}
