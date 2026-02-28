import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLeadDetail } from '@/hooks/useLeadDetail';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useLeadIntents } from '@/hooks/useLeadIntents';
import { useLeadContactIssues } from '@/hooks/useLeadContactIssues';
import { usePessoaContext } from '@/hooks/usePessoaContext';
import { useConversationState } from '@/hooks/useConversationState';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';
import {
  ICP_LABELS,
  PERSONA_LABELS,
  TEMPERATURA_LABELS,
  PRIORIDADE_LABELS,
  ORIGEM_LABELS,
} from '@/types/classification';
import { EditClassificationModal } from '@/components/leads/EditClassificationModal';
import { EditContactModal } from '@/components/leads/EditContactModal';
import { ClassificationExplanation } from '@/components/leads/ClassificationExplanation';
import { ExternalLinks } from '@/components/leads/ExternalLinks';
import { ContactIssuesCard } from '@/components/leads/ContactIssuesCard';
import { ConversationPanel } from '@/components/conversas/ConversationPanel';
import { IntentHistoryCard } from '@/components/intents/IntentHistoryCard';
import { CreateDealFromConversationDialog } from '@/components/conversas/CreateDealFromConversationDialog';
import { LinkedDealsPopover } from '@/components/leads/LinkedDealsPopover';

import { ClickToCallButton } from '@/components/zadarma/ClickToCallButton';
import { PessoaCard } from '@/components/pessoa/PessoaCard';
import { ConversationStateCard } from '@/components/conversation/ConversationStateCard';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Bot,
  Calendar,
  Edit,
  Loader2,
  UserPen,
  Mail,
  MessageCircle,
  Phone,
  Target,
  User,
  Zap,
  Clock,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { ptBR } from 'date-fns/locale';
import type { Temperatura } from '@/types/classification';
import type { EmpresaTipo } from '@/types/sgt';


function TemperatureBadge({ temperatura }: { temperatura: Temperatura }) {
  const colorMap: Record<Temperatura, string> = {
    QUENTE: 'bg-destructive text-destructive-foreground',
    MORNO: 'bg-warning text-warning-foreground',
    FRIO: 'bg-primary text-primary-foreground',
  };

  return (
    <Badge className={colorMap[temperatura]} variant="default">
      {TEMPERATURA_LABELS[temperatura]}
    </Badge>
  );
}

function LeadDetailContent() {
  const { leadId, empresa } = useParams<{ leadId: string; empresa: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [crmContactId, setCrmContactId] = useState<string | null>(null);
  const [linkedDeals, setLinkedDeals] = useState<any[]>([]);
  const { trackPageView } = useAnalyticsEvents();

  useEffect(() => {
    trackPageView('lead_detail');
  }, [trackPageView]);

  // Buscar contact CRM pelo legacy_lead_id + deals vinculados
  useEffect(() => {
    if (!leadId) return;
    supabase
      .from('contacts')
      .select('id')
      .eq('legacy_lead_id', leadId)
      .maybeSingle()
      .then(({ data }) => {
        const contactId = data?.id || null;
        setCrmContactId(contactId);
        if (contactId) {
          supabase
            .from('deals')
            .select('id, titulo, valor, status, pipeline_id, pipeline_stages:stage_id(nome, cor)')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(10)
            .then(({ data: deals }) => setLinkedDeals(deals || []));
        } else {
          setLinkedDeals([]);
        }
      });
  }, [leadId]);

  const { contact, classification, sgtEvents, cadenceRun, isLoading, error, refetch } =
    useLeadDetail(leadId || '', empresa as EmpresaTipo);

  // Usar novo hook com realtime
  const { data: messages = [], isLoading: messagesLoading, isFetching: messagesFetching, error: messagesError, refetch: refetchMessages } = useConversationMessages({
    leadId: leadId || '',
    empresa: empresa as EmpresaTipo,
    telefone: contact?.telefone,
    enabled: !!leadId && !!empresa,
  });

  const { data: intents = [], isLoading: intentsLoading, error: intentsError, refetch: refetchIntents } = useLeadIntents({
    leadId: leadId || '',
    empresa: empresa as EmpresaTipo,
    limit: 5,
    enabled: !!leadId && !!empresa,
  });

  // PATCH 5H-PLUS: Issues de contato
  const { data: contactIssues = [], isLoading: issuesLoading } = useLeadContactIssues({
    leadId: leadId || '',
    empresa: empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
    enabled: !!leadId && !!empresa,
  });

  // PATCH 6: Pessoa Global e Estado de Conversa
  const { data: pessoaContext, isLoading: pessoaLoading } = usePessoaContext({
    leadId: leadId || '',
    empresa: empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
    enabled: !!leadId && !!empresa,
  });

  const { data: conversationState, isLoading: conversationLoading, error: conversationError, refetch: refetchConversation } = useConversationState({
    leadId: leadId || '',
    empresa: empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
    enabled: !!leadId && !!empresa,
  });


  const canEdit = hasRole('ADMIN') || hasRole('CLOSER');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Bot className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Lead não encontrado</h2>
        <p className="text-muted-foreground mb-6">
          O lead "{leadId}" não foi encontrado para a empresa {empresa}.
        </p>
        <Button onClick={() => navigate('/leads')}>Voltar para lista</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-lg">
            {contact.nome || contact.primeiro_nome || 'Lead sem nome'}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={contact.empresa === 'TOKENIZA' ? 'default' : 'secondary'}>
              {contact.empresa}
            </Badge>
            <span className="text-xs text-muted-foreground">ID: {contact.lead_id}</span>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <LinkedDealsPopover deals={linkedDeals} />
            {crmContactId && (
              <Button variant="outline" onClick={() => setCreateDealOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Deal
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditContactOpen(true)}>
              <UserPen className="h-4 w-4 mr-2" />
              Editar Contato
            </Button>
            {classification && (
              <Button variant="outline" onClick={() => setEditModalOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar Classificação
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.nome && (
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{contact.nome}</p>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate select-all cursor-pointer" title={contact.email}>{contact.email}</span>
                </div>
              )}
              {contact.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.telefone}</span>
                  <ClickToCallButton phone={contact.telefone} contactName={contact.nome || contact.primeiro_nome} />
                </div>
              )}
              <Separator />
              <ExternalLinks contact={contact} />
            </CardContent>
          </Card>

          {/* PATCH 5H-PLUS: Contact Issues */}
          <ContactIssuesCard
            issues={contactIssues}
            isLoading={issuesLoading}
            leadId={leadId || ''}
            empresa={empresa || ''}
          />

          {/* Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Classificação
                {classification?.origem === 'MANUAL' && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    Manual
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {classification ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Temperatura</p>
                      <TemperatureBadge temperatura={classification.temperatura} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Prioridade</p>
                      <Badge variant="outline">
                        P{classification.prioridade} -{' '}
                        {PRIORIDADE_LABELS[classification.prioridade]}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">ICP</p>
                    <p className="font-medium">{ICP_LABELS[classification.icp]}</p>
                  </div>
                  {classification.persona && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Persona</p>
                      <p className="font-medium">
                        {PERSONA_LABELS[classification.persona]}
                      </p>
                    </div>
                  )}
                  {classification.score_interno && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Score Interno</p>
                      <p className="font-medium">{classification.score_interno}/100</p>
                    </div>
                  )}
                  <Separator />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Origem: {ORIGEM_LABELS[classification.origem]}</p>
                    <p>
                      Atualizado em:{' '}
                      {format(new Date(classification.updated_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                    {classification.override_motivo && (
                      <div className="mt-2 p-2 bg-muted rounded">
                        <p className="font-medium">Motivo do ajuste:</p>
                        <p>{classification.override_motivo}</p>
                      </div>
                    )}
                  </div>
                  <Separator />
                  {/* Explicação da Classificação */}
                  <ClassificationExplanation justificativa={classification.justificativa} />
                </>
              ) : (
                <p className="text-muted-foreground">Sem classificação ainda.</p>
              )}
            </CardContent>
          </Card>

          {/* PATCH 6: Pessoa Global */}
          <PessoaCard
            pessoa={pessoaContext?.pessoa || null}
            relacionamentos={pessoaContext?.relacionamentos || []}
            isLoading={pessoaLoading}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cadence Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Cadência Ativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cadenceRun ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Cadência em andamento</p>
                      <p className="text-sm text-muted-foreground">
                        Status: {cadenceRun.status}
                      </p>
                    </div>
                    <Badge
                      variant={cadenceRun.status === 'ATIVA' ? 'default' : 'secondary'}
                    >
                      {cadenceRun.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Último passo</p>
                      <p className="font-medium">
                        Passo {cadenceRun.last_step_ordem || 0}
                      </p>
                    </div>
                    {cadenceRun.next_run_at && (() => {
                      const nextRunDate = new Date(cadenceRun.next_run_at);
                      const isPast = nextRunDate < new Date();
                      return (
                        <div>
                          <p className="text-muted-foreground">Próxima execução</p>
                          {isPast ? (
                            <p className="font-medium text-muted-foreground flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Aguardando execução...
                            </p>
                          ) : (
                            <p className="font-medium">
                              {format(nextRunDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                              <span className="text-muted-foreground text-xs ml-1">
                                ({formatDistanceToNow(nextRunDate, { addSuffix: true, locale: ptBR })})
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Nenhuma cadência ativa para este lead.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Conversation Panel — Patch 3 */}
          <ConversationPanel
            leadId={leadId || ''}
            empresa={empresa || ''}
            telefone={contact.telefone}
            leadNome={contact.nome || contact.primeiro_nome}
            messages={messages}
            isLoading={messagesLoading}
            error={messagesError as Error | null}
            onRetry={() => refetchMessages()}
            onRefresh={() => refetchMessages()}
            isRefreshing={messagesFetching}
            modo={conversationState?.modo || 'SDR_IA'}
            assumidoPorNome={null}
            maxHeight="500px"
          />

          {/* PATCH 6: Estado da Conversa */}
          <ConversationStateCard
            state={conversationState || null}
            isLoading={conversationLoading}
            error={conversationError as Error | null}
            onRetry={() => refetchConversation()}
          />

          {/* Intent History - PATCH 5G */}
          <IntentHistoryCard
            intents={intents}
            isLoading={intentsLoading}
            error={intentsError as Error | null}
            onRetry={() => refetchIntents()}
            maxItems={5}
            title="Interpretações IA do Lead"
          />

          {/* SGT Events History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Histórico de Eventos SGT
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sgtEvents && sgtEvents.length > 0 ? (
                <div className="space-y-3">
                  {sgtEvents.slice(0, 10).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{event.evento}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(event.recebido_em),
                              "dd/MM/yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )}
                          </span>
                        </div>
                        {event.processado_em && (
                          <p className="text-xs text-muted-foreground">
                            Processado em:{' '}
                            {format(new Date(event.processado_em), 'HH:mm:ss', {
                              locale: ptBR,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {sgtEvents.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      +{sgtEvents.length - 10} eventos anteriores
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum evento SGT registrado.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Contact Modal */}
      <EditContactModal
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        leadId={contact.lead_id}
        empresa={contact.empresa}
        onSuccess={() => {
          refetch();
          setEditContactOpen(false);
        }}
      />

      {/* Edit Classification Modal */}
      {classification && (
        <EditClassificationModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          classification={classification}
          onSuccess={() => {
            refetch();
            setEditModalOpen(false);
          }}
        />
      )}

      {/* Create Deal Dialog */}
      {crmContactId && (
        <CreateDealFromConversationDialog
          open={createDealOpen}
          onOpenChange={setCreateDealOpen}
          contactId={crmContactId}
          contactNome={contact.nome || contact.primeiro_nome || 'Lead'}
          empresa={empresa || ''}
          onDealCreated={() => {
            setCreateDealOpen(false);
            
          }}
        />
      )}
    </div>
  );
}

export default function LeadDetail() {
  return (
    <AppLayout>
      <LeadDetailContent />
    </AppLayout>
  );
}
