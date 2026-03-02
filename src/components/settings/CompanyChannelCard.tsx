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

                {channel === "meta_cloud" && isEnabled && (
                  <MetaCloudConfigFields empresaId={empresa.id} />
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

function MetaCloudConfigFields({ empresaId }: { empresaId: string }) {
  const queryClient = useQueryClient();
  const settingsKey = `meta_cloud_${empresaId.toLowerCase()}`;

  const { data: setting } = useQuery({
    queryKey: ["system-settings", "integrations", settingsKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("category", "integrations")
        .eq("key", settingsKey)
        .maybeSingle();
      if (error) throw error;
      return data?.value as Record<string, unknown> | null;
    },
  });

  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (setting && !initialized) {
    setAccessToken((setting.access_token as string) || "");
    setAppSecret((setting.app_secret as string) || "");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("system_settings").upsert(
        {
          category: "integrations",
          key: settingsKey,
          value: {
            enabled: true,
            access_token: accessToken,
            app_secret: appSecret,
          },
          updated_at: new Date().toISOString(),
          updated_by: userData.user?.id,
        },
        { onConflict: "category,key" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Credenciais Meta Cloud salvas");
    },
    onError: (error) => {
      toast.error("Erro ao salvar", { description: error.message });
    },
  });

  const hasChanges =
    accessToken !== ((setting?.access_token as string) || "") ||
    appSecret !== ((setting?.app_secret as string) || "");

  return (
    <div className="grid gap-3 border-t pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Access Token</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAxxxxxxx..."
              className="pr-8 text-xs h-8"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">App Secret</Label>
          <div className="relative">
            <Input
              type={showSecret ? "text" : "password"}
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="abcdef123..."
              className="pr-8 text-xs h-8"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      {hasChanges && (
        <Button
          size="sm"
          className="w-fit h-7 text-xs"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-1 h-3 w-3" />
          Salvar
        </Button>
      )}
    </div>
  );
}
