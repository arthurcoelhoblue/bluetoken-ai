import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface SubscriptionData {
  subscription: {
    plan: string;
    status: string;
    user_limit: number;
    current_period_end?: string;
    stripe_subscription_id?: string;
  };
  active_users: number;
  can_add_user: boolean;
}

export function useSubscriptionLimits() {
  const { activeCompany } = useCompany();
  const selectedEmpresa = activeCompany;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription-limits", selectedEmpresa],
    queryFn: async (): Promise<SubscriptionData> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");

      const { data: result, error } = await supabase.functions.invoke("check-subscription", {
        body: { empresa: selectedEmpresa },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result as SubscriptionData;
    },
    enabled: !!selectedEmpresa,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return {
    subscription: data?.subscription ?? { plan: "free", status: "inactive", user_limit: 0 },
    activeUsers: data?.active_users ?? 0,
    canAddUser: data?.can_add_user ?? false,
    isLoading,
    error,
    refetch,
  };
}
