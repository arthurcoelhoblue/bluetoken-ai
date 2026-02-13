import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Pencil, Check, X, Mail, Phone, Building2, DollarSign } from 'lucide-react';
import { useContactDetail, useUpdateContactPage, useContactDeals } from '@/hooks/useContactsPage';
import { useResolvedFields } from '@/hooks/useCustomFields';
import { CustomFieldsRenderer } from './CustomFieldsRenderer';
import { toast } from 'sonner';
import type { ContactWithStats } from '@/types/contactsPage';

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

  const startEdit = (field: string, currentValue: string) => {
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!contactId || !editField) return;
    try {
      await update.mutateAsync({ id: contactId, [editField]: editValue || null } as any);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] flex flex-col overflow-y-auto">
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
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={contact.empresa === 'TOKENIZA' ? 'default' : 'secondary'} className="text-xs">{contact.empresa}</Badge>
                    {contact.is_cliente && <Badge variant="outline" className="text-xs bg-accent/50">Cliente</Badge>}
                    {contact.tipo && <Badge variant="outline" className="text-xs">{contact.tipo}</Badge>}
                  </div>
                </div>
              </div>
              {/* Stats row */}
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>{contact.deals_count} deals</span>
                <span>{contact.deals_abertos} abertos</span>
                <span>{formatCurrency(contact.deals_valor_total)}</span>
              </div>
            </SheetHeader>

            <Tabs defaultValue="dados" className="flex-1 mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="deals">Deals ({contact.deals_count})</TabsTrigger>
                <TabsTrigger value="campos">Campos</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="mt-4 space-y-1">
                {renderInlineField('Email', 'email', contact.email, <Mail className="h-3.5 w-3.5" />)}
                {renderInlineField('Telefone', 'telefone', contact.telefone, <Phone className="h-3.5 w-3.5" />)}
                {renderInlineField('Organização', 'organization_id', contact.org_nome || contact.org_nome_fantasia, <Building2 className="h-3.5 w-3.5" />)}
                {renderInlineField('CPF', 'cpf', contact.cpf)}
                {renderInlineField('Primeiro nome', 'primeiro_nome', contact.primeiro_nome)}
                {renderInlineField('Sobrenome', 'sobrenome', contact.sobrenome)}
                {renderInlineField('Endereço', 'endereco', contact.endereco)}
                {renderInlineField('Canal de origem', 'canal_origem', contact.canal_origem)}
                {renderInlineField('Notas', 'notas', contact.notas)}
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
                    <Card key={d.id} className="cursor-default">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{d.titulo}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {d.pipeline_stages && (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={{ borderColor: d.pipeline_stages.cor, color: d.pipeline_stages.cor }}
                                >
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
    </Sheet>
  );
}
