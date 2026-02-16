import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useCreateOrgPage } from '@/hooks/useOrganizationsPage';
import { toast } from 'sonner';
import { organizationCreateSchema, type OrgCreateFormData } from '@/schemas/contacts';

const SETOR_OPTIONS = ['Tecnologia', 'Finanças', 'Saúde', 'Educação', 'Varejo', 'Indústria', 'Serviços', 'Outro'];
const PORTE_OPTIONS = ['MEI', 'ME', 'EPP', 'Médio', 'Grande'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrgCreateDialog({ open, onOpenChange }: Props) {
  const { activeCompany } = useCompany();
  const create = useCreateOrgPage();

  const form = useForm<OrgCreateFormData>({
    resolver: zodResolver(organizationCreateSchema),
    defaultValues: {
      nome: '', nome_fantasia: '', cnpj: '', telefone: '', email: '',
      setor: '', porte: '', website: '', endereco: '', cidade: '', estado: '', cep: '',
    },
  });

  const handleCreate = async (data: OrgCreateFormData) => {
    const empresa = activeCompany as 'BLUE' | 'TOKENIZA';
    try {
      await create.mutateAsync({
        nome: data.nome.trim(),
        empresa,
        nome_fantasia: data.nome_fantasia || undefined,
        cnpj: data.cnpj || undefined,
        telefone: data.telefone || undefined,
        email: data.email || undefined,
        setor: data.setor || undefined,
        porte: data.porte || undefined,
        website: data.website || undefined,
        endereco: data.endereco || undefined,
        cidade: data.cidade || undefined,
        estado: data.estado || undefined,
        cep: data.cep || undefined,
      });
      toast.success('Organização criada com sucesso');
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error('Erro ao criar organização');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Organização</DialogTitle>
          <DialogDescription>Dados da empresa/organização.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreate)} className="grid gap-4 py-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Razão Social *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nome_fantasia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Fantasia</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="setor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Setor</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {SETOR_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="porte" render={({ field }) => (
                <FormItem>
                  <FormLabel>Porte</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PORTE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="website" render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco" render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="cidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estado" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl><Input {...field} maxLength={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cep" render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Organização
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
