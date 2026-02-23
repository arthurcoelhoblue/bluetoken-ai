import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useCreateDeal } from '@/hooks/useDeals';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDealAutoFill } from '@/hooks/useDealAutoFill';
import type { PipelineStage } from '@/types/deal';
import { toast } from 'sonner';
import { createDealSchema, type CreateDealFormData } from '@/schemas/deals';
import { Brain, UserPlus, ChevronsUpDown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { QuickCreateContactDialog } from './QuickCreateContactDialog';
import { cn } from '@/lib/utils';

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

function useContactSearch(search: string, empresa: string) {
  return useQuery({
    queryKey: ['contacts-search', empresa, search],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('id, nome, telefone, email')
        .eq('empresa', empresa as 'BLUE' | 'TOKENIZA')
        .eq('is_active', true)
        .order('nome')
        .limit(50);

      if (search.trim()) {
        query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
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
  const empresa = activeCompany as 'BLUE' | 'TOKENIZA';

  const [contactSearch, setContactSearch] = useState('');
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [manualContact, setManualContact] = useState<{ id: string; nome: string } | null>(null);

  const { data: searchResults = [] } = useContactSearch(contactSearch, empresa);
  const createDeal = useCreateDeal();
  const { data: vendedores = [] } = useVendedores();
  const [showQuickContact, setShowQuickContact] = useState(false);

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

  // Merge manual contact into results so it's always visible
  const allContacts = useMemo(() => {
    if (!manualContact) return searchResults;
    const exists = searchResults.some(c => c.id === manualContact.id);
    if (exists) return searchResults;
    return [{ id: manualContact.id, nome: manualContact.nome, telefone: null, email: null }, ...searchResults];
  }, [searchResults, manualContact]);

  const contactId = form.watch('contact_id');
  const selectedContactName = allContacts.find(c => c.id === contactId)?.nome;

  const handleSubmit = async (data: CreateDealFormData) => {
    const finalContactId = data.contact_id;

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
      setManualContact(null);
      setContactSearch('');
    } catch {
      toast.error('Erro ao criar deal');
    }
  };

  const { data: autoFill } = useDealAutoFill(contactId || undefined);

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

            <FormField control={form.control} name="contact_id" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Contato</FormLabel>
                <div className="flex gap-2">
                  <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("flex-1 justify-between font-normal", !field.value && "text-muted-foreground")}
                        >
                          {selectedContactName || "Buscar contato..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar por nome, email ou telefone..."
                          value={contactSearch}
                          onValueChange={setContactSearch}
                        />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                          <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                          <CommandGroup>
                            {allContacts.map(c => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => {
                                  field.onChange(c.id);
                                  setContactPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", field.value === c.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span className="text-sm">{c.nome}</span>
                                  {(c.telefone || c.email) && (
                                    <span className="text-xs text-muted-foreground">{c.telefone || c.email}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowQuickContact(true)}
                    title="Criar novo contato"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </FormItem>
            )} />

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
        <QuickCreateContactDialog
          open={showQuickContact}
          onOpenChange={setShowQuickContact}
          onCreated={(contact) => {
            setManualContact(contact);
            form.setValue('contact_id', contact.id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
