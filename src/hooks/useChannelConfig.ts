import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveChannel = 'bluechat' | 'mensageria';

export interface ChannelConfigResult {
  activeChannel: ActiveChannel;
  isBluechat: boolean;
  isMensageria: boolean;
  isLoading: boolean;
}

/**
 * Hook that resolves the active channel for a given empresa.
 * Returns whether bluechat or mensageria is active.
 */
export function useChannelConfig(empresa: string): ChannelConfigResult {
  const { data, isLoading } = useQuery({
    queryKey: ["channel-config", empresa],
    queryFn: async () => {
      const { data: config } = await supabase
        .from("integration_company_config" as any)
        .select("channel, enabled")
        .eq("empresa", empresa)
        .eq("enabled", true)
        .maybeSingle();

      const activeChannel = ((config as any)?.channel as ActiveChannel | undefined) ?? 'mensageria';
      return { activeChannel };
    },
    enabled: !!empresa,
    staleTime: 60_000,
  });

  const ch = data?.activeChannel ?? 'mensageria';

  return {
    activeChannel: ch,
    isBluechat: ch === 'bluechat',
    isMensageria: ch === 'mensageria',
    isLoading,
  };
}
