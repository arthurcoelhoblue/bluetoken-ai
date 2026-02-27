import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Send,
  Headphones,
  Settings,
  Check,
  X,
} from "lucide-react";
import { IntegrationInfo } from "@/types/settings";
import {
  useIntegrationCompanyConfig,
  type ChannelType,
} from "@/hooks/useIntegrationCompanyConfig";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Send,
  Headphones,
};

interface CompanyChannelCardProps {
  integration: IntegrationInfo;
  onConfigure: () => void;
}

export function CompanyChannelCard({
  integration,
  onConfigure,
}: CompanyChannelCardProps) {
  const { getConfig, toggleConfig } = useIntegrationCompanyConfig();
  const Icon = iconMap[integration.icon] || Settings;
  const channel = integration.id as ChannelType;
  const hasSecrets = integration.secrets.length > 0;

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas" as any)
        .select("id, label, is_active")
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  return (
    <Card className="relative col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              <CardDescription className="text-xs">
                {integration.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSecrets && (
              <Button variant="outline" size="sm" onClick={onConfigure}>
                <Settings className="mr-1 h-3 w-3" />
                Configurar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          {empresas.map((empresa: any) => {
            const config = getConfig(empresa.id, channel);
            const isEnabled = config?.enabled ?? false;

            return (
              <div
                key={empresa.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    {empresa.label || empresa.id}
                  </Badge>
                  <Badge
                    variant={isEnabled ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {isEnabled ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Ativo
                      </>
                    ) : (
                      <>
                        <X className="mr-1 h-3 w-3" />
                        Inativo
                      </>
                    )}
                  </Badge>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) =>
                    toggleConfig.mutate({
                      empresa: empresa.id,
                      channel,
                      enabled: checked,
                    })
                  }
                  disabled={toggleConfig.isPending}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
