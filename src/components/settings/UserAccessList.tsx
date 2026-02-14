import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Plus, X } from 'lucide-react';
import { useUsersWithProfiles, useRemoveAssignment } from '@/hooks/useAccessControl';
import { AssignProfileDialog } from './AssignProfileDialog';
import { CreateUserDialog } from './CreateUserDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UserWithAccess } from '@/types/accessControl';

export function UserAccessList() {
  const { data: users = [], isLoading } = useUsersWithProfiles();
  const removeMutation = useRemoveAssignment();
  const queryClient = useQueryClient();

  const [assignTarget, setAssignTarget] = useState<UserWithAccess | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleToggleVendedor = async (userId: string, value: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_vendedor: value }).eq('id', userId);
    if (error) {
      toast.error('Erro ao atualizar flag vendedor');
      return;
    }
    toast.success(value ? 'Marcado como vendedor' : 'Removido de vendedor');
    queryClient.invalidateQueries({ queryKey: ['users-with-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline-owners'] });
  };

  const getInitials = (nome: string | null, email: string) => {
    if (nome) return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando usuários...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Usuários</h3>
          <p className="text-sm text-muted-foreground">
            Atribua perfis de acesso e empresa a cada usuário
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-center">Vendedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users as UserWithAccess[]).map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(u.nome, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{u.nome || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {u.profile_name ? (
                    <Badge variant="outline">{u.profile_name}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sem perfil (roles legado)</span>
                  )}
                </TableCell>
                <TableCell>
                  {u.assignment?.empresa ? (
                    <Badge variant="secondary">{u.assignment.empresa}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Todas</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={(u as UserWithAccess & { is_vendedor?: boolean }).is_vendedor ?? false}
                    onCheckedChange={(val) => handleToggleVendedor(u.id, val)}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? 'default' : 'destructive'} className="text-xs">
                    {u.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAssignTarget(u)}
                      title="Atribuir perfil"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    {u.assignment && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMutation.mutate(u.id)}
                        title="Remover atribuição"
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {assignTarget && (
        <AssignProfileDialog
          open={!!assignTarget}
          onOpenChange={(open) => !open && setAssignTarget(null)}
          userId={assignTarget.id}
          userName={assignTarget.nome || assignTarget.email}
          currentProfileId={assignTarget.assignment?.access_profile_id}
          currentEmpresa={assignTarget.assignment?.empresa}
        />
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
