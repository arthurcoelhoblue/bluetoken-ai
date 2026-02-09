import { useState } from "react";
import { IntegrationCard } from "./IntegrationCard";
import { CompanyChannelCard } from "./CompanyChannelCard";
import { INTEGRATIONS, IntegrationConfig } from "@/types/settings";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIntegrationHealth } from "@/hooks/useIntegrationHealth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function IntegrationsTab() {
  const { settings, updateSetting, isLoading } = useSystemSettings("integrations");
  const { checkHealth, getStatus } = useIntegrationHealth();
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);

  const globalIntegrations = INTEGRATIONS.filter((i) => !i.perCompany);
  const perCompanyIntegrations = INTEGRATIONS.filter((i) => i.perCompany);

  const getIntegrationConfig = (key: string): IntegrationConfig | null => {
    const setting = settings?.find((s) => s.key === key);
    if (!setting?.value) return null;
    return setting.value as unknown as IntegrationConfig;
  };

  const handleToggle = async (integrationKey: string, enabled: boolean) => {
    const current = getIntegrationConfig(integrationKey) || { enabled: false };
    await updateSetting.mutateAsync({
      category: "integrations",
      key: integrationKey,
      value: { ...current, enabled },
    });
  };

  const handleTest = async (integrationId: string) => {
    setTestingIntegration(integrationId);
    const result = await checkHealth(integrationId);
    setTestingIntegration(null);

    if (result.status === "online") {
      toast.success(`${INTEGRATIONS.find((i) => i.id === integrationId)?.name} está online!`, {
        description: result.latencyMs ? `Latência: ${result.latencyMs}ms` : undefined,
      });
    } else {
      toast.error(`Falha ao conectar`, {
        description: result.message || "Verifique as configurações",
      });
    }
  };

  const selectedIntegrationInfo = INTEGRATIONS.find(
    (i) => i.id === selectedIntegration
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ative ou desative integrações conforme necessário. Clique em "Testar" para verificar a conectividade.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {globalIntegrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            config={getIntegrationConfig(integration.settingsKey)}
            onToggle={(enabled) =>
              handleToggle(integration.settingsKey, enabled)
            }
            onConfigure={() => setSelectedIntegration(integration.id)}
            onTest={integration.testable ? () => handleTest(integration.id) : undefined}
            healthStatus={getStatus(integration.id)}
            isUpdating={updateSetting.isPending}
            isTesting={testingIntegration === integration.id}
          />
        ))}
      </div>

      {perCompanyIntegrations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Canais por Empresa</h3>
          <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Blue Chat e Mensageria são mutuamente exclusivos por empresa. Ao ativar um, o outro é desativado automaticamente.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {perCompanyIntegrations.map((integration) => (
              <CompanyChannelCard
                key={integration.id}
                integration={integration}
                onConfigure={() => setSelectedIntegration(integration.id)}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={!!selectedIntegration}
        onOpenChange={(open) => !open && setSelectedIntegration(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Configurar {selectedIntegrationInfo?.name}
            </DialogTitle>
            <DialogDescription>
              Secrets necessários para esta integração
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Os seguintes secrets precisam estar configurados no ambiente:
            </p>
            <ul className="space-y-2">
              {selectedIntegrationInfo?.secrets.map((secret) => (
                <li
                  key={secret}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <code className="flex-1 font-mono text-sm">{secret}</code>
                </li>
              ))}
            </ul>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Secrets são gerenciados diretamente no ambiente de deploy para maior segurança.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
