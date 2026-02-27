import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Sparkles } from 'lucide-react';
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
import { ConversationPanel } from '@/components/conversas/ConversationPanel';

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

  // Resolve legacy_lead_id and empresa from contact
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

  // Conversation messages for Chat tab
  const { data: chatMessages = [], isLoading: chatLoading, refetch: refetchChat, isFetching: chatFetching } = useConversationMessages({
    leadId: contactBridge?.legacy_lead_id ?? '',
    contactId: contactBridge?.id,
    empresa: contactBridge?.empresa as 'BLUE' | 'TOKENIZA' | undefined,
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

  const isClosed = deal?.status === 'GANHO' || deal?.status === 'PERDIDO';
  const orderedStages = (stages ?? []).filter(s => !s.is_won && !s.is_lost).sort((a, b) => a.posicao - b.posicao);

  const tabCount = hasChat ? 5 : 4;

  const handleWin = () => {
    if (!deal) return;
    closeDeal.mutate({ dealId: deal.id, status: 'GANHO', stageId: deal.stage_id }, {
      onSuccess: () => toast.success('Deal marcado como ganho!'),
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
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col overflow-y-auto p-0">
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
                <TabsList className={`grid w-full grid-cols-${tabCount} mx-6 mt-3`} style={{ width: 'calc(100% - 3rem)', gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  {hasChat && (
                    <TabsTrigger value="chat" className="gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Chat
                    </TabsTrigger>
                  )}
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
    </>
  );
}
