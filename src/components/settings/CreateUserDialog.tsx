import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useAccessProfiles } from '@/hooks/useAccessControl';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createUserSchema, type CreateUserFormData } from '@/schemas/users';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUPER_ADMIN_NAME = 'Super Admin';

export function CreateUserDialog({ open, onOpenChange }: Props) {
  const { empresaRecords } = useCompany();
  const { data: profiles = [] } = useAccessProfiles();
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-profiles-for-gestor'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
  const queryClient = useQueryClient();

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      nome: '', email: '', password: '', profileId: '', empresa: 'all', gestorId: 'none', isVendedor: false, ramal: '',
    },
  });

  const availableProfiles = profiles.filter(p => p.nome !== SUPER_ADMIN_NAME);

  const handleSubmit = async (data: CreateUserFormData) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email.trim(),
          nome: data.nome.trim(),
          password: data.password,
          access_profile_id: data.profileId || undefined,
          empresa: data.empresa === 'all' ? undefined : data.empresa,
          gestor_id: data.gestorId === 'none' ? undefined : data.gestorId,
          is_vendedor: data.isVendedor,
          ramal: data.ramal || undefined,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      toast.success(`Usuário ${data.nome} criado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['users-with-profiles'] });
      form.reset();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar usuário';
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl><Input {...field} placeholder="Nome completo" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl><Input type="email" {...field} placeholder="email@empresa.com" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Senha temporária *</FormLabel>
                <FormControl><Input type="password" {...field} placeholder="Mínimo 6 caracteres" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="profileId" render={({ field }) => (
              <FormItem>
                <FormLabel>Perfil de Acesso</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {availableProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="gestorId" render={({ field }) => (
              <FormItem>
                <FormLabel>Gestor</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o gestor" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="isVendedor" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Vendedor</FormLabel>
                  <FormDescription>Este usuário participa de metas, comissões e rankings</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="ramal" render={({ field }) => (
              <FormItem>
                <FormLabel>Ramal</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: 100" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="empresa" render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {empresaRecords.filter(e => e.is_active).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
