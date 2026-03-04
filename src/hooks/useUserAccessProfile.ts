import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserAccessProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-access-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_access_assignments')
        .select('access_profile_id, access_profiles(nome)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const profileData = data.access_profiles as unknown as { nome: string } | null;
      return profileData?.nome ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
