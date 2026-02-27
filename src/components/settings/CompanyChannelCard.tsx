import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Send,
  Headphones,
  Settings,
  Check,
  X,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { IntegrationInfo } from "@/types/settings";
import {
  useIntegrationCompanyConfig,
  type ChannelType,
} from "@/hooks/useIntegrationCompanyConfig";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();
  const Icon = iconMap[integration.icon] || Settings;
  const channel = integration.id as ChannelType;
  const hasSecrets = integration.secrets.length > 0;
  const isMensageria = channel === "mensageria";

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
        <div className="grid grid-cols-1 gap-4">
          {empresas.map((empresa: any) => {
            const config = getConfig(empresa.id, channel);
            const isEnabled = config?.enabled ?? false;

            return (
              <div
                key={empresa.id}
                className="rounded-lg border p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
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

                {isMensageria && isEnabled && (
                  <MensageriaConfigFields
                    empresaId={empresa.id}
                    config={config}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MensageriaConfigFields({
  empresaId,
  config,
}: {
  empresaId: string;
  config: any;
}) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState(config?.api_key || "");
  const [connectionName, setConnectionName] = useState(
    config?.connection_name || ""
  );
  const [showApiKey, setShowApiKey] = useState(false);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("integration_company_config" as any)
        .update({
          api_key: apiKey || null,
          connection_name: connectionName || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("empresa", empresaId)
        .eq("channel", "mensageria");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["integration-company-config"],
      });
      toast.success("Configuração da Mensageria salva");
    },
    onError: (error) => {
      toast.error("Erro ao salvar", { description: error.message });
    },
  });

  const hasChanges =
    apiKey !== (config?.api_key || "") ||
    connectionName !== (config?.connection_name || "");

  return (
    <div className="grid gap-3 border-t pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">API Key</Label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="conn_..."
              className="pr-8 text-xs h-8"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Connection Name
          </Label>
          <Input
            type="text"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            placeholder="ex: arthur"
            className="text-xs h-8"
          />
        </div>
      </div>
      {hasChanges && (
        <Button
          size="sm"
          className="w-fit h-7 text-xs"
          onClick={() => saveConfig.mutate()}
          disabled={saveConfig.isPending}
        >
          <Save className="mr-1 h-3 w-3" />
          Salvar
        </Button>
      )}
    </div>
  );
}
