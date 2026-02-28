import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { editUserSchema, type EditUserFormData } from '@/schemas/users';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentNome: string;
  currentEmail: string;
  currentIsVendedor: boolean;
  currentIsActive: boolean;
  currentGestorId: string | null;
  currentRamal: string;
}

export function EditUserDialog({
  open, onOpenChange, userId, currentNome, currentEmail,
  currentIsVendedor, currentIsActive, currentGestorId, currentRamal,
}: Props) {
  const { roles } = useAuth();
  const isAdmin = roles.includes('ADMIN');

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-profiles-for-gestor'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
  const queryClient = useQueryClient();

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      nome: currentNome || '',
      isVendedor: currentIsVendedor,
      isActive: currentIsActive,
      gestorId: currentGestorId || 'none',
      ramal: currentRamal || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: currentNome || '',
        isVendedor: currentIsVendedor,
        isActive: currentIsActive,
        gestorId: currentGestorId || 'none',
        ramal: currentRamal || '',
      });
    }
  }, [open, currentNome, currentIsVendedor, currentIsActive, currentGestorId, currentRamal, form]);

  const handleSubmit = async (data: EditUserFormData) => {
    try {
      // Update profile
      const { error: profileError } = await supabase.from('profiles').update({
        nome: data.nome.trim(),
        is_vendedor: data.isVendedor,
        is_active: data.isActive,
        gestor_id: data.gestorId === 'none' ? null : data.gestorId,
      }).eq('id', userId);

      if (profileError) throw profileError;

      // Update ramal
      if (data.ramal) {
        await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
        const { error } = await supabase.from('zadarma_extensions').insert({
          user_id: userId,
          extension_number: data.ramal,
          empresa: 'BLUE',
        });
        if (error) throw error;
      } else if (currentRamal) {
        const { error } = await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
        if (error) throw error;
      }

      toast.success('Usuário atualizado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['users-with-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-owners'] });
      queryClient.invalidateQueries({ queryKey: ['zadarma-extensions-all'] });
      queryClient.invalidateQueries({ queryKey: ['zadarma-my-extension'] });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar usuário';
      toast.error(message);
    }
  };

  // Filter out self from gestor list
  const gestorOptions = allUsers.filter(u => u.id !== userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm">{currentEmail}</p>
            </div>

            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl><Input {...field} placeholder="Nome completo" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="gestorId" render={({ field }) => (
              <FormItem>
                <FormLabel>Gestor</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o gestor" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {gestorOptions.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            {isAdmin && (
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Ativo</FormLabel>
                    <FormDescription>Usuários inativos não conseguem acessar o sistema</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            )}

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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
