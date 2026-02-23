import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SystemSetting } from "@/types/settings";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export function useSystemSettings(category?: string) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["system-settings", category],
    queryFn: async () => {
      let query = supabase
        .from("system_settings")
        .select("*")
        .order("category")
        .order("key");

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SystemSetting[];
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({
      category,
      key,
      value,
    }: {
      category: string;
      key: string;
      value: Record<string, unknown>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          category,
          key,
          value: value as unknown as Json,
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id,
        }, { onConflict: "category,key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Configuração atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar configuração: " + error.message);
    },
  });

  const getSetting = (key: string): SystemSetting | undefined => {
    return settings?.find((s) => s.key === key);
  };

  const getSettingValue = <T>(key: string, defaultValue: T): T => {
    const setting = getSetting(key);
    return setting?.value as T ?? defaultValue;
  };

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    getSetting,
    getSettingValue,
  };
}
