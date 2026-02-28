import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useCreateContactPage } from '@/hooks/useContactsPage';
import { toast } from 'sonner';
import { contactCreateSchema, type ContactCreateFormData } from '@/schemas/contacts';
import { checkContactDuplicates, type DuplicateMatch } from '@/hooks/useContactDuplicateCheck';
import { DuplicateContactAlert } from '@/components/contacts/DuplicateContactAlert';

const TIPO_OPTIONS = ['LEAD', 'CLIENTE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO'] as const;
const CANAL_OPTIONS = ['WhatsApp', 'Email', 'Telefone', 'Site', 'Indicação', 'Outro'] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactCreateDialog({ open, onOpenChange }: Props) {
  const { activeCompany } = useCompany();
  const { data: orgs } = useOrganizations();
  const create = useCreateContactPage();
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checking, setChecking] = useState(false);

  const form = useForm<ContactCreateFormData>({
    resolver: zodResolver(contactCreateSchema),
    defaultValues: {
      nome: '', primeiro_nome: '', sobrenome: '', email: '', telefone: '',
      cpf: '', notas: '', canal_origem: '', organization_id: '', is_cliente: false,
    },
  });

  const doCreate = async (data: ContactCreateFormData) => {
    const empresa = activeCompany as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
    try {
      await create.mutateAsync({
        ...data,
        nome: data.nome.trim(),
        empresa,
        email: data.email || undefined,
        telefone: data.telefone || undefined,
        cpf: data.cpf || undefined,
        canal_origem: data.canal_origem || undefined,
        organization_id: data.organization_id || undefined,
        notas: data.notas || undefined,
      });
      toast.success('Contato criado com sucesso');
      onOpenChange(false);
      form.reset();
      setDuplicates([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('duplicate key') || msg.includes('idx_contacts_email') || msg.includes('idx_contacts_telefone')) {
        toast.error('Já existe um contato ativo com este email ou telefone.');
      } else {
        toast.error('Erro ao criar contato');
      }
    }
  };

  const handleCreate = async (data: ContactCreateFormData) => {
    const empresa = activeCompany as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
    setChecking(true);
    try {
      const matches = await checkContactDuplicates({
        email: data.email || undefined,
        telefone: data.telefone || undefined,
        empresa,
      });
      if (matches.length > 0) {
        setDuplicates(matches);
        return;
      }
    } finally {
      setChecking(false);
    }
    await doCreate(data);
  };

  const handleViewContact = (id: string) => {
    window.open(`/contatos?contact=${id}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setDuplicates([]); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
          <DialogDescription>Preencha os dados para criar um novo contato.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreate)} className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="primeiro_nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primeiro nome</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sobrenome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sobrenome</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo *</FormLabel>
                <FormControl><Input {...field} placeholder="Nome completo" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {TIPO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cpf" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="canal_origem" render={({ field }) => (
                <FormItem>
                  <FormLabel>Canal de origem</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CANAL_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="organization_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Organização</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {orgs?.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.nome_fantasia || o.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notas" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea {...field} rows={2} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="is_cliente" render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    id="is_cliente"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel htmlFor="is_cliente" className="text-sm cursor-pointer !mt-0">Já é cliente</FormLabel>
              </FormItem>
            )} />

            {duplicates.length > 0 && (
              <DuplicateContactAlert
                duplicates={duplicates}
                onViewContact={handleViewContact}
                onForceCreate={() => {
                  setDuplicates([]);
                  doCreate(form.getValues());
                }}
                isPending={create.isPending}
              />
            )}

            {duplicates.length === 0 && (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending || checking}>
                  {(create.isPending || checking) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Contato
                </Button>
              </DialogFooter>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
