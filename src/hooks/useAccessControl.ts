import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AccessProfile, PermissionsMap, UserAccessAssignment } from '@/types/accessControl';
import { toast } from 'sonner';

export function useAccessProfiles() {
  return useQuery({
    queryKey: ['access-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_profiles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('nome');
      if (error) throw error;
      return (data ?? []) as unknown as AccessProfile[];
    },
  });
}

export function useCreateAccessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nome: string; descricao?: string; permissions: PermissionsMap }) => {
      const { data, error } = await supabase
        .from('access_profiles')
        .insert({ nome: payload.nome, descricao: payload.descricao ?? null, permissions: payload.permissions as any })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AccessProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-profiles'] });
      toast.success('Perfil criado com sucesso');
    },
    onError: (e: Error) => toast.error(`Erro ao criar perfil: ${e.message}`),
  });
}

export function useUpdateAccessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; nome: string; descricao?: string; permissions: PermissionsMap }) => {
      const { error } = await supabase
        .from('access_profiles')
        .update({ nome: payload.nome, descricao: payload.descricao ?? null, permissions: payload.permissions as any })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-profiles'] });
      toast.success('Perfil atualizado');
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  });
}

export function useDeleteAccessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('access_profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access-profiles'] });
      toast.success('Perfil excluído');
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

export function useUserAssignments() {
  return useQuery({
    queryKey: ['user-access-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_access_assignments')
        .select('*');
      if (error) throw error;
      return (data ?? []) as UserAccessAssignment[];
    },
  });
}

export function useUsersWithProfiles() {
  return useQuery({
    queryKey: ['users-with-profiles'],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, nome, avatar_url, is_active')
        .order('nome');
      if (pErr) throw pErr;

      const { data: assignments, error: aErr } = await supabase
        .from('user_access_assignments')
        .select('*');
      if (aErr) throw aErr;

      const { data: accessProfiles, error: apErr } = await supabase
        .from('access_profiles')
        .select('id, nome');
      if (apErr) throw apErr;

      const assignMap = new Map((assignments ?? []).map((a: any) => [a.user_id, a]));
      const profileMap = new Map((accessProfiles ?? []).map((p: any) => [p.id, p.nome]));

      return (profiles ?? []).map((u: any) => {
        const assignment = assignMap.get(u.id) || null;
        return {
          ...u,
          assignment,
          profile_name: assignment ? (profileMap.get(assignment.access_profile_id) ?? null) : null,
        };
      });
    },
  });
}

export function useAssignProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; access_profile_id: string; empresa: 'BLUE' | 'TOKENIZA' | null }) => {
      const { error } = await supabase
        .from('user_access_assignments')
        .upsert(
          { user_id: payload.user_id, access_profile_id: payload.access_profile_id, empresa: payload.empresa },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-with-profiles'] });
      qc.invalidateQueries({ queryKey: ['user-access-assignments'] });
      toast.success('Perfil atribuído');
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}

export function useRemoveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_access_assignments')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-with-profiles'] });
      qc.invalidateQueries({ queryKey: ['user-access-assignments'] });
      toast.success('Atribuição removida');
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}
