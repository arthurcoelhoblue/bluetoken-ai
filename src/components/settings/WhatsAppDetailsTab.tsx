import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIntegrationHealth } from "@/hooks/useIntegrationHealth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppModoTeste } from "@/types/settings";
import { MessageCircle, CheckCircle2, XCircle, Loader2, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppDetailsTab() {
  const { isLoading, updateSetting, getSettingValue } = useSystemSettings("whatsapp");
  const { checkHealth, getStatus } = useIntegrationHealth();
  const [isTesting, setIsTesting] = useState(false);

  const modoTeste = getSettingValue<WhatsAppModoTeste>("modo_teste", {
    ativo: true,
    numero_teste: "",
  });

  const status = getStatus("whatsapp");

  // Message stats from last 7 days
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["whatsapp-stats"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("lead_messages")
        .select("estado, direcao, created_at")
        .eq("canal", "WHATSAPP")
        .gte("created_at", sevenDaysAgo.toISOString());

      if (error) throw error;

      const sent = data?.filter((m) => m.direcao === "OUTBOUND") || [];
      const received = data?.filter((m) => m.direcao === "INBOUND") || [];
      const delivered = sent.filter((m) => m.estado === "ENTREGUE" || m.estado === "LIDO");
      const errors = sent.filter((m) => m.estado === "ERRO");

      return {
        totalSent: sent.length,
        totalReceived: received.length,
        delivered: delivered.length,
        errors: errors.length,
        deliveryRate: sent.length > 0 ? (delivered.length / sent.length) * 100 : 0,
        errorRate: sent.length > 0 ? (errors.length / sent.length) * 100 : 0,
      };
    },
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await checkHealth("whatsapp");
    setIsTesting(false);
    
    if (result.status === "online") {
      toast.success("WhatsApp/Mensageria está online!", {
        description: result.latencyMs ? `Latência: ${result.latencyMs}ms` : undefined,
      });
    } else {
      toast.error("Falha na conexão", {
        description: result.message,
      });
    }
  };

  const handleToggleModoTeste = (ativo: boolean) => {
    updateSetting.mutate({
      category: "whatsapp",
      key: "modo_teste",
      value: { ...modoTeste, ativo },
    });
  };

  const handleNumeroTesteChange = (numero_teste: string) => {
    updateSetting.mutate({
      category: "whatsapp",
      key: "modo_teste",
      value: { ...modoTeste, numero_teste },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Verifique se a integração com WhatsApp/Mensageria está funcionando.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {status?.status === "online" && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {status?.status === "offline" && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {status?.status === "error" && (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                {status?.status === "checking" && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
                {!status && (
                  <div className="h-5 w-5 rounded-full bg-muted" />
                )}
                <span className="font-medium">Mensageria API</span>
              </div>
              {status?.status === "online" && (
                <Badge variant="default" className="bg-green-500">Online</Badge>
              )}
              {status?.status === "offline" && (
                <Badge variant="destructive">Offline</Badge>
              )}
              {status?.status === "error" && (
                <Badge variant="secondary">{status.message}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              {status?.latencyMs && (
                <span className="text-sm text-muted-foreground">
                  Latência: {status.latencyMs}ms
                </span>
              )}
              {status?.checkedAt && (
                <span className="text-xs text-muted-foreground">
                  Verificado: {status.checkedAt.toLocaleTimeString()}
                </span>
              )}
              <Button onClick={handleTestConnection} disabled={isTesting}>
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Testar Conexão
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Modo de Teste</CardTitle>
          <CardDescription>
            Quando ativado, todas as mensagens serão enviadas apenas para o número de teste.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Modo de teste ativo</Label>
              <p className="text-sm text-muted-foreground">
                Redireciona todas as mensagens para o número de teste
              </p>
            </div>
            <Switch
              checked={modoTeste.ativo}
              onCheckedChange={handleToggleModoTeste}
            />
          </div>

          {modoTeste.ativo && (
            <div className="space-y-2">
              <Label htmlFor="numero_teste">Número de teste (E.164)</Label>
              <Input
                id="numero_teste"
                value={modoTeste.numero_teste}
                onChange={(e) => handleNumeroTesteChange(e.target.value)}
                placeholder="5511999999999"
              />
              <p className="text-xs text-muted-foreground">
                Formato: código do país + DDD + número, sem espaços ou caracteres especiais
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Estatísticas (últimos 7 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Enviadas</p>
                  <p className="text-2xl font-bold">{stats.totalSent}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Recebidas</p>
                  <p className="text-2xl font-bold">{stats.totalReceived}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Taxa de Entrega</p>
                  <p className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Taxa de Erro</p>
                  <p className="text-2xl font-bold text-destructive">{stats.errorRate.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-muted-foreground">Sem dados disponíveis</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
