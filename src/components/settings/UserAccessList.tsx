import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Plus, X, ShieldCheck, Pencil } from 'lucide-react';
import { useUsersWithProfiles, useRemoveAssignment, useAccessProfiles } from '@/hooks/useAccessControl';
import { AssignProfileDialog } from './AssignProfileDialog';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog } from './EditUserDialog';
import { UserPermissionOverrideDialog } from './UserPermissionOverrideDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UserWithAccess, PermissionsMap } from '@/types/accessControl';

export function UserAccessList() {
  const { data: users = [], isLoading } = useUsersWithProfiles();
  const { data: profiles = [] } = useAccessProfiles();
  const { data: extensions = [] } = useQuery({
    queryKey: ['zadarma-extensions-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zadarma_extensions').select('user_id, extension_number, empresa');
      if (error) throw error;
      return (data ?? []) as { user_id: string; extension_number: string; empresa: string }[];
    },
  });
  const removeMutation = useRemoveAssignment();
  const queryClient = useQueryClient();

  const [assignTarget, setAssignTarget] = useState<UserWithAccess | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<UserWithAccess | null>(null);
  const [editTarget, setEditTarget] = useState<UserWithAccess | null>(null);
  const [editingRamal, setEditingRamal] = useState<string | null>(null);
  const [ramalValue, setRamalValue] = useState('');

  const getRamal = (userId: string) => {
    const ext = extensions.find(e => e.user_id === userId);
    return ext?.extension_number ?? '';
  };

  const handleSaveRamal = async (userId: string) => {
    setEditingRamal(null);
    const current = getRamal(userId);
    if (ramalValue === current) return;

    if (ramalValue) {
      const { data: assignments } = await supabase
        .from('user_access_assignments')
        .select('empresa')
        .eq('user_id', userId);
      const empresas = [...new Set(assignments?.map(a => a.empresa) ?? [])];
      await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
      for (const emp of empresas) {
        const { error } = await supabase.from('zadarma_extensions').insert({
          user_id: userId,
          extension_number: ramalValue,
          empresa: emp as any,
        });
        if (error) { toast.error('Erro ao salvar ramal'); return; }
      }
    } else if (current) {
      const { error } = await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
      if (error) { toast.error('Erro ao remover ramal'); return; }
    }
    toast.success('Ramal atualizado');
    queryClient.invalidateQueries({ queryKey: ['zadarma-extensions-all'] });
    queryClient.invalidateQueries({ queryKey: ['zadarma-my-extension'] });
  };

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

  const handleToggleCsm = async (userId: string, value: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_csm: value }).eq('id', userId);
    if (error) {
      toast.error('Erro ao atualizar flag CS');
      return;
    }
    toast.success(value ? 'Marcado como CS' : 'Removido do time de CS');
    queryClient.invalidateQueries({ queryKey: ['users-with-profiles'] });
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
            Atribua perfis de acesso e empresas a cada usuário
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
              <TableHead>Empresas</TableHead>
              <TableHead className="text-center">Vendedor</TableHead>
              <TableHead className="text-center">CS</TableHead>
              <TableHead>Ramal</TableHead>
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
                  {u.assignments.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.assignments.map(a => (
                        <Badge key={a.id} variant="secondary" className="text-xs">
                          {a.empresa || 'Todas'}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhuma</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={u.is_vendedor ?? false}
                    onCheckedChange={(val) => handleToggleVendedor(u.id, val)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={u.is_csm ?? false}
                    onCheckedChange={(val) => handleToggleCsm(u.id, val)}
                  />
                </TableCell>
                <TableCell>
                  {editingRamal === u.id ? (
                    <Input
                      className="h-7 w-20 text-xs"
                      value={ramalValue}
                      onChange={e => setRamalValue(e.target.value)}
                      onBlur={() => handleSaveRamal(u.id)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveRamal(u.id)}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-xs cursor-pointer hover:underline text-muted-foreground"
                      onClick={() => { setEditingRamal(u.id); setRamalValue(getRamal(u.id)); }}
                    >
                      {getRamal(u.id) || '—'}
                    </span>
                  )}
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
                      onClick={() => setEditTarget(u)}
                      title="Editar usuário"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAssignTarget(u)}
                      title="Atribuir perfil"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOverrideTarget(u)}
                      title="Permissões individuais"
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                    {u.assignments.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMutation.mutate(u.id)}
                        title="Remover todas atribuições"
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
          currentProfileId={assignTarget.assignments[0]?.access_profile_id}
          currentEmpresas={assignTarget.assignments.map(a => a.empresa).filter(Boolean) as ('BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA')[]}
        />
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editTarget && (
        <EditUserDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          userId={editTarget.id}
          currentNome={editTarget.nome || ''}
          currentEmail={editTarget.email}
          currentIsVendedor={editTarget.is_vendedor ?? false}
          currentIsActive={editTarget.is_active ?? true}
          currentGestorId={(editTarget as any).gestor_id ?? null}
          currentRamal={getRamal(editTarget.id)}
        />
      )}

      {overrideTarget && (
        <UserPermissionOverrideDialog
          open={!!overrideTarget}
          onOpenChange={(open) => !open && setOverrideTarget(null)}
          userId={overrideTarget.id}
          userName={overrideTarget.nome || overrideTarget.email}
          currentOverride={
            (overrideTarget.assignments[0] as { permissions_override?: PermissionsMap } | undefined)?.permissions_override
              ? (overrideTarget.assignments[0] as { permissions_override?: PermissionsMap }).permissions_override!
              : null
          }
          profilePermissions={
            overrideTarget.assignments[0]?.access_profile_id
              ? ((profiles.find(p => p.id === overrideTarget.assignments[0]?.access_profile_id)?.permissions ?? null) as PermissionsMap | null)
              : null
          }
        />
      )}
    </div>
  );
}