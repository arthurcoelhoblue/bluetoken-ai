import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import type { AccessProfile, PermissionsMap, UserAccessAssignment, UserWithAccess } from '@/types/accessControl';
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
        .insert({ nome: payload.nome, descricao: payload.descricao ?? null, permissions: payload.permissions as never })
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
        .update({ nome: payload.nome, descricao: payload.descricao ?? null, permissions: payload.permissions as never })
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
        .select('id, email, nome, avatar_url, is_active, is_vendedor, is_csm')
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

      // Group assignments by user_id (now supports multiple per user)
      const assignMap = new Map<string, UserAccessAssignment[]>();
      for (const a of (assignments ?? [])) {
        const assignment = a as unknown as UserAccessAssignment;
        const list = assignMap.get(assignment.user_id) || [];
        list.push(assignment);
        assignMap.set(assignment.user_id, list);
      }
      const profileMap = new Map((accessProfiles ?? []).map((p) => [(p as unknown as { id: string; nome: string }).id, (p as unknown as { id: string; nome: string }).nome]));

      return (profiles ?? []).map((u) => {
        const user = u as unknown as { id: string; email: string; nome: string; avatar_url: string | null; is_active: boolean; is_vendedor: boolean; is_csm: boolean };
        const userAssignments = assignMap.get(user.id) || [];
        const firstAssignment = userAssignments[0] || null;
        return {
          ...user,
          assignments: userAssignments,
          profile_name: firstAssignment ? (profileMap.get(firstAssignment.access_profile_id) ?? null) : null,
        } as UserWithAccess;
      });
    },
  });
}

export function useAssignProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; access_profile_id: string; empresas: string[] }) => {
      // 1. Upsert new assignments first (safe: never leaves user without access)
      for (const empresa of payload.empresas) {
        const { error } = await supabase
          .from('user_access_assignments')
          .upsert(
            {
              user_id: payload.user_id,
              access_profile_id: payload.access_profile_id,
              empresa: empresa as Database['public']['Enums']['empresa_tipo'],
            },
            { onConflict: 'user_id,empresa' }
          );
        if (error) throw error;
      }

      // 2. Delete only assignments NOT in the new list
      const { error: delErr } = await supabase
        .from('user_access_assignments')
        .delete()
        .eq('user_id', payload.user_id)
        .not('empresa', 'in', `(${payload.empresas.join(',')})`);
      if (delErr) throw delErr;
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