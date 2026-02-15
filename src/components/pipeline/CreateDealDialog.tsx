import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useCreateDeal } from '@/hooks/useDeals';
import { useContacts, useCreateContact } from '@/hooks/useContacts';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDealAutoFill } from '@/hooks/useDealAutoFill';
import type { PipelineStage } from '@/types/deal';
import { toast } from 'sonner';
import { createDealSchema, type CreateDealFormData } from '@/schemas/deals';
import { Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

function useVendedores() {
  return useQuery({
    queryKey: ['vendedores-list'],
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

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: PipelineStage[];
}

export function CreateDealDialog({ open, onOpenChange, pipelineId, stages }: CreateDealDialogProps) {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const empresa = activeCompany === 'ALL' ? 'BLUE' : activeCompany as 'BLUE' | 'TOKENIZA';

  const { data: contactsData } = useContacts();
  const contacts = contactsData?.data;
  const createDeal = useCreateDeal();
  const createContact = useCreateContact();
  const { data: vendedores = [] } = useVendedores();

  const activeStages = stages.filter(s => !s.is_won && !s.is_lost);
  const defaultStageId = activeStages[0]?.id ?? '';

  const form = useForm<CreateDealFormData>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      titulo: '',
      valor: 0,
      temperatura: 'FRIO',
      contact_id: '',
      contact_nome: '',
      stage_id: defaultStageId,
      owner_id: user?.id ?? '',
    },
  });

  const handleSubmit = async (data: CreateDealFormData) => {
    let finalContactId = data.contact_id;

    if (!finalContactId && data.contact_nome?.trim()) {
      try {
        const contact = await createContact.mutateAsync({ nome: data.contact_nome.trim(), empresa });
        finalContactId = contact.id;
      } catch {
        toast.error('Erro ao criar contato');
        return;
      }
    }

    if (!finalContactId) {
      toast.error('Selecione ou crie um contato');
      return;
    }

    try {
      await createDeal.mutateAsync({
        titulo: data.titulo.trim(),
        contact_id: finalContactId,
        pipeline_id: pipelineId,
        stage_id: data.stage_id || defaultStageId,
        valor: data.valor,
        temperatura: data.temperatura,
        owner_id: data.owner_id,
      });
      toast.success('Deal criado com sucesso');
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao criar deal');
    }
  };

  const contactId = form.watch('contact_id');
  const { data: autoFill } = useDealAutoFill(contactId || undefined);

  // Auto-fill fields when AI suggestions arrive
  useEffect(() => {
    if (!autoFill) return;
    const current = form.getValues();
    if (autoFill.titulo && !current.titulo) form.setValue('titulo', autoFill.titulo);
    if (autoFill.valor && current.valor === 0) form.setValue('valor', autoFill.valor);
    if (autoFill.temperatura && current.temperatura === 'FRIO') form.setValue('temperatura', autoFill.temperatura);
  }, [autoFill, form]);

  const hasAiSuggestions = autoFill && (autoFill.titulo || autoFill.valor || autoFill.temperatura);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Deal</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {hasAiSuggestions && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                <Brain className="h-4 w-4 shrink-0" />
                Campos pré-preenchidos pela Amélia com base nas conversas.
              </div>
            )}
            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Declaração IR 2025" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div>
              <FormField control={form.control} name="contact_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contato</FormLabel>
                  {contacts && contacts.length > 0 ? (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione um contato" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormField control={form.control} name="contact_nome" render={({ field: nomeField }) => (
                      <FormControl><Input {...nomeField} placeholder="Nome do novo contato" /></FormControl>
                    )} />
                  )}
                </FormItem>
              )} />
              {contacts && contacts.length > 0 && !contactId && (
                <FormField control={form.control} name="contact_nome" render={({ field }) => (
                  <FormControl><Input className="mt-2" {...field} placeholder="Ou crie um novo contato..." /></FormControl>
                )} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="valor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} placeholder="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="temperatura" render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperatura</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="FRIO">Frio</SelectItem>
                      <SelectItem value="MORNO">Morno</SelectItem>
                      <SelectItem value="QUENTE">Quente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="owner_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Vendedor Responsável *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {vendedores.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="stage_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Stage Inicial</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {activeStages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={createDeal.isPending}>
              {createDeal.isPending ? 'Criando...' : 'Criar Deal'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
