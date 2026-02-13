import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Pencil, Check, X, Building2, Globe, Phone, Mail, MapPin } from 'lucide-react';
import { useOrgDetail, useUpdateOrgPage, useOrgContacts } from '@/hooks/useOrganizationsPage';
import { useResolvedFields } from '@/hooks/useCustomFields';
import { CustomFieldsRenderer } from '@/components/contacts/CustomFieldsRenderer';
import { ContactDetailSheet } from '@/components/contacts/ContactDetailSheet';
import { toast } from 'sonner';

interface Props {
  orgId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrgDetailSheet({ orgId, open, onOpenChange }: Props) {
  const { data: org, isLoading } = useOrgDetail(orgId);
  const { data: contacts } = useOrgContacts(orgId);
  const resolvedFields = useResolvedFields('ORGANIZATION', orgId);
  const update = useUpdateOrgPage();
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [contactDetailId, setContactDetailId] = useState<string | null>(null);

  const startEdit = (field: string, currentValue: string) => {
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!orgId || !editField) return;
    try {
      await update.mutateAsync({ id: orgId, [editField]: editValue || null } as any);
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

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[520px] sm:max-w-[520px] flex flex-col overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 pt-6">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : org ? (
            <>
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg truncate">{org.nome_fantasia || org.nome}</SheetTitle>
                    {org.nome_fantasia && <p className="text-xs text-muted-foreground truncate">{org.nome}</p>}
                    <Badge variant={org.empresa === 'TOKENIZA' ? 'default' : 'secondary'} className="text-xs mt-1">{org.empresa}</Badge>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{org.contacts_count} contatos</span>
                  <span>{org.deals_count} deals</span>
                  <span>{formatCurrency(org.deals_valor_total)}</span>
                </div>
              </SheetHeader>

              <Tabs defaultValue="dados" className="flex-1 mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="contatos">Contatos ({org.contacts_count})</TabsTrigger>
                  <TabsTrigger value="campos">Campos</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="mt-4 space-y-1">
                  {renderInlineField('CNPJ', 'cnpj', org.cnpj)}
                  {renderInlineField('Telefone', 'telefone', org.telefone, <Phone className="h-3.5 w-3.5" />)}
                  {renderInlineField('Email', 'email', org.email, <Mail className="h-3.5 w-3.5" />)}
                  {renderInlineField('Website', 'website', org.website, <Globe className="h-3.5 w-3.5" />)}
                  {renderInlineField('Setor', 'setor', org.setor)}
                  {renderInlineField('Porte', 'porte', org.porte)}
                  {renderInlineField('Endereço', 'endereco', org.endereco, <MapPin className="h-3.5 w-3.5" />)}
                  {renderInlineField('Cidade', 'cidade', org.cidade)}
                  {renderInlineField('Estado', 'estado', org.estado)}
                  {renderInlineField('CEP', 'cep', org.cep)}
                  {renderInlineField('Notas', 'notas', org.notas)}
                </TabsContent>

                <TabsContent value="contatos" className="mt-4 space-y-2">
                  {!contacts?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato vinculado.</p>
                  ) : (
                    contacts.map((c: any) => (
                      <button
                        key={c.id}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                        onClick={() => setContactDetailId(c.id)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {c.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.email || c.telefone || '—'}</p>
                        </div>
                        {c.is_cliente && <Badge variant="outline" className="text-xs">Cliente</Badge>}
                      </button>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="campos" className="mt-4">
                  <CustomFieldsRenderer
                    fields={resolvedFields}
                    entityType="ORGANIZATION"
                    entityId={orgId!}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-12">Organização não encontrada.</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Nested contact detail */}
      <ContactDetailSheet
        contactId={contactDetailId}
        open={!!contactDetailId}
        onOpenChange={(o) => !o && setContactDetailId(null)}
      />
    </>
  );
}
