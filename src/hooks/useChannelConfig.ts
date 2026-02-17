import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChannelConfigResult {
  isBluechat: boolean;
  isMensageria: boolean;
  isLoading: boolean;
  bluechatFrontendUrl: string | null;
}

/**
 * Hook that resolves the active channel for a given empresa.
 * Returns whether bluechat or mensageria is active, plus the Blue Chat frontend URL.
 */
export function useChannelConfig(empresa: string): ChannelConfigResult {
  const { data, isLoading } = useQuery({
    queryKey: ["channel-config", empresa],
    queryFn: async () => {
      // 1. Check integration_company_config
      const { data: config } = await supabase
        .from("integration_company_config" as any)
        .select("channel, enabled")
        .eq("empresa", empresa)
        .eq("enabled", true)
        .maybeSingle();

      const activeChannel = (config as any)?.channel as string | undefined;
      const isBluechat = activeChannel === "bluechat";

      // 2. If bluechat, also fetch frontend URL from system_settings
      let bluechatFrontendUrl: string | null = null;
      if (isBluechat) {
        const settingsKey = empresa === "BLUE" ? "bluechat_blue" : "bluechat_tokeniza";
        const { data: setting } = await supabase
          .from("system_settings")
          .select("value")
          .eq("category", "integrations")
          .eq("key", settingsKey)
          .maybeSingle();

        bluechatFrontendUrl =
          ((setting?.value as Record<string, unknown>)?.frontend_url as string) || null;
      }

      return { isBluechat, bluechatFrontendUrl };
    },
    enabled: !!empresa,
    staleTime: 60_000, // Cache for 1 minute
  });

  return {
    isBluechat: data?.isBluechat ?? false,
    isMensageria: !(data?.isBluechat ?? false),
    isLoading,
    bluechatFrontendUrl: data?.bluechatFrontendUrl ?? null,
  };
}
