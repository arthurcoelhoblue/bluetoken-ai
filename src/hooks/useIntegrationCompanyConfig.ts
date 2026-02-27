import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EmpresaTipo = string;
export type ChannelType = "mensageria" | "meta_cloud";

export interface IntegrationCompanyConfig {
  id: string;
  empresa: EmpresaTipo;
  channel: ChannelType;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  mensageria: "Mensageria",
  meta_cloud: "Meta Cloud API",
};

export function useIntegrationCompanyConfig() {
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["integration-company-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_company_config" as any)
        .select("*")
        .order("empresa")
        .order("channel");

      if (error) throw error;
      return data as unknown as IntegrationCompanyConfig[];
    },
  });

  const toggleConfig = useMutation({
    mutationFn: async ({
      empresa,
      channel,
      enabled,
    }: {
      empresa: EmpresaTipo;
      channel: ChannelType;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from("integration_company_config" as any)
        .update({ enabled, updated_at: new Date().toISOString() } as never)
        .eq("empresa", empresa)
        .eq("channel", channel);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["integration-company-config"] });

      if (variables.enabled) {
        const otherChannel: ChannelType =
          variables.channel === "mensageria" ? "meta_cloud" : "mensageria";
        toast.success(
          `${CHANNEL_LABELS[variables.channel]} ativado para ${variables.empresa}`,
          {
            description: `${CHANNEL_LABELS[otherChannel]} foi desativado automaticamente`,
          }
        );
      } else {
        toast.info(
          `${CHANNEL_LABELS[variables.channel]} desativado para ${variables.empresa}`
        );
      }
    },
    onError: (error) => {
      toast.error("Erro ao atualizar configuração", {
        description: error.message,
      });
    },
  });

  const getConfig = (
    empresa: EmpresaTipo,
    channel: ChannelType
  ): IntegrationCompanyConfig | undefined => {
    return configs?.find((c) => c.empresa === empresa && c.channel === channel);
  };

  return {
    configs,
    isLoading,
    toggleConfig,
    getConfig,
  };
}
