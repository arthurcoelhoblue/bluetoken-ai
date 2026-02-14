import { useState } from 'react';
import { DealDetailSheet } from '@/components/deals/DealDetailSheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Pencil, Check, X, Mail, Phone, Building2, DollarSign, Target, Zap, MessageCircle, Linkedin } from 'lucide-react';
import { useContactDetail, useUpdateContactPage, useContactDeals } from '@/hooks/useContactsPage';
import { useResolvedFields } from '@/hooks/useCustomFields';
import { useContactLeadBridge } from '@/hooks/useContactLeadBridge';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { CustomFieldsRenderer } from './CustomFieldsRenderer';
import { ConversationPanel } from '@/components/conversas/ConversationPanel';
import { ClickToCallButton } from '@/components/zadarma/ClickToCallButton';
import { toast } from 'sonner';
import type { ContactWithStats } from '@/types/contactsPage';
import type { EmpresaTipo } from '@/types/sgt';

interface Props {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailSheet({ contactId, open, onOpenChange }: Props) {
  const { data: contact, isLoading } = useContactDetail(contactId);
  const { data: deals } = useContactDeals(contactId);
  const resolvedFields = useResolvedFields('CONTACT', contactId);
  const update = useUpdateContactPage();
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Bridge to legacy lead data
  const bridge = useContactLeadBridge(open ? contactId : null);

  // Conversation messages via legacy_lead_id
  const { data: messages = [], isLoading: messagesLoading } = useConversationMessages({
    leadId: bridge.legacyLeadId || '',
    empresa: bridge.empresa,
    telefone: bridge.telefone,
    enabled: !!bridge.legacyLeadId && open,
  });

  const startEdit = (field: string, currentValue: string) => {
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!contactId || !editField) return;
    try {
      await update.mutateAsync({ id: contactId, [editField]: editValue || null } as Parameters<typeof update.mutateAsync>[0]);
      toast.success('Campo atualizado');
    } catch {
      toast.error('Erro ao atualizar');
    }
    setEditField(null);
  };

  const cancelEdit = () => {
    setEditField(null);
    setEditValue('');
  };

  const initials = contact?.nome?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  const renderInlineField = (label: string, field: string, value: string | null, icon?: React.ReactNode) => {
    const isEditing = editField === field;
    return (
      <div className="group flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground">{label}</span>
            {isEditing ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <p className="text-sm truncate">{value || '—'}</p>
            )}
          </div>
        </div>
        {!isEditing && (
          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => startEdit(field, value || '')}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const hasLegacyData = !!bridge.legacyLeadId;
  const tabCount = 3 + (hasLegacyData ? 2 : 0); // dados, deals, campos + classificação + mensagens

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[560px] sm:max-w-[560px] flex flex-col overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : contact ? (
          <>
            <SheetHeader className="pb-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg truncate">{contact.nome}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={contact.empresa === 'TOKENIZA' ? 'default' : 'secondary'} className="text-xs">{contact.empresa}</Badge>
                    {contact.is_cliente && <Badge variant="outline" className="text-xs bg-accent/50">Cliente</Badge>}
                    {contact.tipo && <Badge variant="outline" className="text-xs">{contact.tipo}</Badge>}
                    {contact.opt_out && <Badge variant="destructive" className="text-xs">Opt-out</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>{contact.deals_count} deals</span>
                <span>{contact.deals_abertos} abertos</span>
                <span>{formatCurrency(contact.deals_valor_total)}</span>
                {contact.score_marketing != null && (
                  <span>Score MKT: {contact.score_marketing}</span>
                )}
              </div>
            </SheetHeader>

            <Tabs defaultValue="dados" className="flex-1 mt-4">
              <TabsList className={`grid w-full ${hasLegacyData ? 'grid-cols-5' : 'grid-cols-3'}`}>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="deals">Deals ({contact.deals_count})</TabsTrigger>
                {hasLegacyData && (
                  <TabsTrigger value="classificacao">
                    <Target className="h-3 w-3 mr-1" />IA
                  </TabsTrigger>
                )}
                {hasLegacyData && (
                  <TabsTrigger value="mensagens">
                    <MessageCircle className="h-3 w-3 mr-1" />Chat
                  </TabsTrigger>
                )}
                <TabsTrigger value="campos">Campos</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="mt-4 space-y-1">
                {renderInlineField('Email', 'email', contact.email, <Mail className="h-3.5 w-3.5" />)}
                <div className="flex items-center gap-1">
                  <div className="flex-1">{renderInlineField('Telefone', 'telefone', contact.telefone, <Phone className="h-3.5 w-3.5" />)}</div>
                  <ClickToCallButton phone={contact.telefone} contactName={contact.nome} />
                </div>
                {renderInlineField('Organização', 'organization_id', contact.org_nome || contact.org_nome_fantasia, <Building2 className="h-3.5 w-3.5" />)}
                {renderInlineField('CPF', 'cpf', contact.cpf)}
                {renderInlineField('Primeiro nome', 'primeiro_nome', contact.primeiro_nome)}
                {renderInlineField('Sobrenome', 'sobrenome', contact.sobrenome)}
                {renderInlineField('Endereço', 'endereco', contact.endereco)}
                {renderInlineField('Canal de origem', 'canal_origem', contact.canal_origem)}
                {renderInlineField('Notas', 'notas', contact.notas)}
                {/* LinkedIn info from legacy sync */}
                {contact.linkedin_url && (
                  <div className="py-2 px-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Linkedin className="h-3 w-3" /> LinkedIn</span>
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
                      {contact.linkedin_cargo ? `${contact.linkedin_cargo} @ ${contact.linkedin_empresa || ''}` : contact.linkedin_url}
                    </a>
                  </div>
                )}
                {contact.owner_nome && (
                  <div className="py-2 px-2">
                    <span className="text-xs text-muted-foreground">Responsável</span>
                    <p className="text-sm">{contact.owner_nome}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deals" className="mt-4 space-y-3">
                {!deals?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal vinculado.</p>
                ) : (
                  deals.map((d: any) => (
                    <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedDealId(d.id)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{d.titulo}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {d.pipeline_stages && (
                                <Badge variant="outline" className="text-xs" style={{ borderColor: d.pipeline_stages.cor, color: d.pipeline_stages.cor }}>
                                  {d.pipeline_stages.nome}
                                </Badge>
                              )}
                              <Badge variant={d.status === 'GANHO' ? 'default' : d.status === 'PERDIDO' ? 'destructive' : 'secondary'} className="text-xs">
                                {d.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatCurrency(d.valor || 0)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Classification tab (via bridge) */}
              {hasLegacyData && (
                <TabsContent value="classificacao" className="mt-4">
                  {bridge.classification ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Classificação IA</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs text-muted-foreground">ICP</span>
                            <p className="text-sm font-medium">{bridge.classification.icp}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Temperatura</span>
                            <Badge variant={bridge.classification.temperatura === 'QUENTE' ? 'destructive' : bridge.classification.temperatura === 'MORNO' ? 'default' : 'secondary'} className="text-xs">
                              {bridge.classification.temperatura}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Prioridade</span>
                            <p className="text-sm font-medium">P{bridge.classification.prioridade}</p>
                          </div>
                          {bridge.classification.score_interno != null && (
                            <div>
                              <span className="text-xs text-muted-foreground">Score</span>
                              <p className="text-sm font-medium">{bridge.classification.score_interno}/100</p>
                            </div>
                          )}
                        </div>
                        {bridge.classification.persona && (
                          <div>
                            <span className="text-xs text-muted-foreground">Persona</span>
                            <p className="text-sm">{bridge.classification.persona}</p>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Origem: {bridge.classification.origem}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem classificação IA.</p>
                  )}

                  {/* Cadence info */}
                  {bridge.cadenceRun && (
                    <Card className="mt-3">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5" /> Cadência Ativa
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Passo {bridge.cadenceRun.last_step_ordem || 0}</span>
                          <Badge variant="default" className="text-xs">{bridge.cadenceRun.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* Messages/Conversation tab */}
              {hasLegacyData && (
                <TabsContent value="mensagens" className="mt-4">
                  <ConversationPanel
                    leadId={bridge.legacyLeadId!}
                    empresa={bridge.empresa || contact.empresa}
                    telefone={bridge.telefone || contact.telefone}
                    leadNome={contact.nome}
                    messages={messages}
                    isLoading={messagesLoading}
                    modo={(bridge.conversationState?.modo as any) || 'SDR_IA'}
                    assumidoPorNome={null}
                    maxHeight="400px"
                  />
                </TabsContent>
              )}

              <TabsContent value="campos" className="mt-4">
                <CustomFieldsRenderer
                  fields={resolvedFields}
                  entityType="CONTACT"
                  entityId={contactId!}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-12">Contato não encontrado.</p>
        )}
      </SheetContent>

      <DealDetailSheet
        dealId={selectedDealId}
        open={!!selectedDealId}
        onOpenChange={open => !open && setSelectedDealId(null)}
      />
    </Sheet>
  );
}
