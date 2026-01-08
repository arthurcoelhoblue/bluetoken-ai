import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAIMetrics } from "@/hooks/useAIMetrics";
import { useIntegrationHealth } from "@/hooks/useIntegrationHealth";
import { AI_PROVIDERS, ModelPriority } from "@/types/settings";
import { Brain, ArrowUp, ArrowDown, CheckCircle2, XCircle, Loader2, DollarSign, Zap, Clock, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export function AISettingsTab() {
  const { settings, isLoading, updateSetting, getSettingValue } = useSystemSettings("ia");
  const { metrics, isLoading: metricsLoading } = useAIMetrics(30);
  const { checkHealth, getStatus } = useIntegrationHealth();

  const modelPriority = getSettingValue<ModelPriority>("model_priority", {
    ordem: ["ANTHROPIC", "GEMINI", "GPT"],
    modelos: {
      ANTHROPIC: "claude-sonnet-4-20250514",
      GEMINI: "google/gemini-2.5-flash",
      GPT: "openai/gpt-5-mini",
    },
    desabilitados: [],
  });

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrdem = [...modelPriority.ordem];
    [newOrdem[index - 1], newOrdem[index]] = [newOrdem[index], newOrdem[index - 1]];
    updateSetting.mutate({
      category: "ia",
      key: "model_priority",
      value: { ...modelPriority, ordem: newOrdem },
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === modelPriority.ordem.length - 1) return;
    const newOrdem = [...modelPriority.ordem];
    [newOrdem[index], newOrdem[index + 1]] = [newOrdem[index + 1], newOrdem[index]];
    updateSetting.mutate({
      category: "ia",
      key: "model_priority",
      value: { ...modelPriority, ordem: newOrdem },
    });
  };

  const handleToggleProvider = (providerId: string, enabled: boolean) => {
    const newDesabilitados = enabled
      ? modelPriority.desabilitados.filter((d) => d !== providerId)
      : [...modelPriority.desabilitados, providerId];
    updateSetting.mutate({
      category: "ia",
      key: "model_priority",
      value: { ...modelPriority, desabilitados: newDesabilitados },
    });
  };

  const handleModelChange = (providerId: string, model: string) => {
    updateSetting.mutate({
      category: "ia",
      key: "model_priority",
      value: {
        ...modelPriority,
        modelos: { ...modelPriority.modelos, [providerId]: model },
      },
    });
  };

  const handleTestProvider = async (providerId: string) => {
    const integrationKey = providerId === "ANTHROPIC" ? "anthropic" : "lovable_ai";
    const result = await checkHealth(integrationKey);
    if (result.status === "online") {
      toast.success(`${providerId} está online!`, {
        description: result.latencyMs ? `Latência: ${result.latencyMs}ms` : undefined,
      });
    } else {
      toast.error(`${providerId} offline`, {
        description: result.message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Priority Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Prioridade de Modelos
          </CardTitle>
          <CardDescription>
            Configure a ordem de prioridade e modelos específicos para cada provedor de IA.
            O sistema tentará o primeiro habilitado e fará fallback para os próximos em caso de erro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {modelPriority.ordem.map((providerId, index) => {
            const provider = AI_PROVIDERS.find((p) => p.id === providerId);
            if (!provider) return null;

            const isDisabled = modelPriority.desabilitados.includes(providerId);
            const currentModel = modelPriority.modelos[providerId] || provider.models[0];
            const status = getStatus(providerId === "ANTHROPIC" ? "anthropic" : "lovable_ai");

            return (
              <div
                key={providerId}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  isDisabled ? "bg-muted/50 opacity-60" : "bg-card"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === modelPriority.ordem.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>

                <Badge variant="outline" className="w-8 justify-center">
                  {index + 1}
                </Badge>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{provider.name}</span>
                    {status?.status === "online" && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {status?.status === "offline" && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {status?.status === "checking" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Select
                    value={currentModel}
                    onValueChange={(v) => handleModelChange(providerId, v)}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className="w-64 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {provider.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestProvider(providerId)}
                  disabled={isDisabled}
                >
                  Testar
                </Button>

                <Switch
                  checked={!isDisabled}
                  onCheckedChange={(checked) => handleToggleProvider(providerId, checked)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Metrics Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Uso (últimos 30 dias)</CardTitle>
          <CardDescription>
            Consumo de tokens e custo estimado por provedor de IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : metrics ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Zap className="h-4 w-4" />
                      Total de Chamadas
                    </div>
                    <p className="text-2xl font-bold">{metrics.totalCalls.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Brain className="h-4 w-4" />
                      Tokens Consumidos
                    </div>
                    <p className="text-2xl font-bold">{metrics.totalTokens.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <DollarSign className="h-4 w-4" />
                      Custo Estimado
                    </div>
                    <p className="text-2xl font-bold">${metrics.totalCostUSD.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <TrendingDown className="h-4 w-4" />
                      Taxa de Fallback
                    </div>
                    <p className="text-2xl font-bold">{metrics.fallbackRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>

              {/* By Provider */}
              <div className="space-y-3">
                <h4 className="font-medium">Por Provedor</h4>
                {metrics.byProvider.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum dado disponível</p>
                ) : (
                  <div className="space-y-2">
                    {metrics.byProvider.map((provider) => (
                      <div
                        key={provider.provider}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{provider.provider}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {provider.totalCalls} chamadas
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="flex items-center gap-1">
                            <Brain className="h-3 w-3" />
                            {provider.totalTokens.toLocaleString()} tokens
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {provider.avgProcessingMs}ms avg
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <DollarSign className="h-3 w-3" />
                            ${provider.estimatedCostUSD.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Erro ao carregar métricas</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
