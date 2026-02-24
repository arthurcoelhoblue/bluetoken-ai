import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const editContactSchema = z.object({
  nome: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100),
  primeiro_nome: z.string().max(50).optional().or(z.literal('')),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  telefone: z.string().max(30).optional().or(z.literal('')),
  cpf: z.string().regex(/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})?$/, 'CPF inválido').optional().or(z.literal('')),
  tipo: z.string().optional().or(z.literal('')),
  canal_origem: z.string().max(50).optional().or(z.literal('')),
  notas: z.string().max(2000).optional().or(z.literal('')),
});

type EditContactFormData = z.infer<typeof editContactSchema>;

interface EditContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  empresa: string;
  onSuccess: () => void;
}

const TIPO_OPTIONS = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'PARCEIRO', label: 'Parceiro' },
  { value: 'FORNECEDOR', label: 'Fornecedor' },
  { value: 'OUTRO', label: 'Outro' },
];

export function EditContactModal({ open, onOpenChange, leadId, empresa, onSuccess }: EditContactModalProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);

  const form = useForm<EditContactFormData>({
    resolver: zodResolver(editContactSchema),
    defaultValues: {
      nome: '',
      primeiro_nome: '',
      email: '',
      telefone: '',
      cpf: '',
      tipo: '',
      canal_origem: '',
      notas: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    supabase
      .from('contacts')
      .select('id, nome, primeiro_nome, email, telefone, cpf, tipo, canal_origem, notas')
      .eq('legacy_lead_id', leadId)
      .maybeSingle()
      .then(({ data, error }) => {
        setFetching(false);
        if (error) {
          toast.error('Erro ao buscar contato');
          return;
        }
        if (data) {
          setContactId(data.id);
          form.reset({
            nome: data.nome || '',
            primeiro_nome: data.primeiro_nome || '',
            email: data.email || '',
            telefone: data.telefone || '',
            cpf: data.cpf || '',
            tipo: data.tipo || '',
            canal_origem: data.canal_origem || '',
            notas: data.notas || '',
          });
        }
      });
  }, [open, leadId]);

  const onSubmit = async (values: EditContactFormData) => {
    if (!contactId) {
      toast.error('Contato não encontrado');
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('contacts')
      .update({
        nome: values.nome,
        primeiro_nome: values.primeiro_nome || null,
        email: values.email || null,
        telefone: values.telefone || null,
        cpf: values.cpf || null,
        tipo: values.tipo || null,
        canal_origem: values.canal_origem || null,
        notas: values.notas || null,
      })
      .eq('id', contactId);

    setLoading(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success('Contato atualizado com sucesso');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Contato</DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" {...form.register('nome')} />
              {form.formState.errors.nome && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.nome.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="primeiro_nome">Primeiro nome</Label>
              <Input id="primeiro_nome" {...form.register('primeiro_nome')} />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...form.register('telefone')} />
            </div>

            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" placeholder="000.000.000-00" {...form.register('cpf')} />
              {form.formState.errors.cpf && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.cpf.message}</p>
              )}
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={form.watch('tipo') || ''}
                onValueChange={(v) => form.setValue('tipo', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="canal_origem">Canal de origem</Label>
              <Input id="canal_origem" {...form.register('canal_origem')} />
            </div>

            <div>
              <Label htmlFor="notas">Notas</Label>
              <Textarea id="notas" rows={3} {...form.register('notas')} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
