import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  type EmpresaTipo,
  type ChannelType,
} from "@/hooks/useIntegrationCompanyConfig";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Send,
  Headphones,
};

const EMPRESAS: EmpresaTipo[] = ["TOKENIZA", "BLUE"];

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
          {EMPRESAS.map((empresa) => {
            const config = getConfig(empresa, channel);
            const isEnabled = config?.enabled ?? false;

            return (
              <div
                key={empresa}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    {empresa}
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
                      empresa,
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
