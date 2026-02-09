import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppInlineDetails() {
  const { isLoading, updateSetting, getSettingValue } = useSystemSettings("whatsapp");
  const { checkHealth, getStatus } = useIntegrationHealth();
  const [isTesting, setIsTesting] = useState(false);

  const modoTeste = getSettingValue<WhatsAppModoTeste>("modo_teste", {
    ativo: true,
    numero_teste: "",
  });

  const status = getStatus("whatsapp");

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
      toast.error("Falha na conexão", { description: result.message });
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
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Connection Status */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="flex items-center gap-2">
          {status?.status === "online" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status?.status === "offline" && <XCircle className="h-4 w-4 text-destructive" />}
          {status?.status === "error" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
          {status?.status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!status && <div className="h-4 w-4 rounded-full bg-muted" />}
          <span className="text-sm font-medium">Mensageria API</span>
          {status?.status === "online" && <Badge variant="default" className="bg-green-500 text-xs">Online</Badge>}
          {status?.status === "offline" && <Badge variant="destructive" className="text-xs">Offline</Badge>}
          {status?.latencyMs && status.status === "online" && (
            <span className="text-xs text-muted-foreground">{status.latencyMs}ms</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={isTesting}>
          {isTesting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Testar
        </Button>
      </div>

      {/* Test Mode */}
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Modo de teste</Label>
            <p className="text-xs text-muted-foreground">Redireciona mensagens para número de teste</p>
          </div>
          <Switch checked={modoTeste.ativo} onCheckedChange={handleToggleModoTeste} />
        </div>
        {modoTeste.ativo && (
          <div className="space-y-1">
            <Label htmlFor="numero_teste" className="text-xs">Número de teste (E.164)</Label>
            <Input
              id="numero_teste"
              value={modoTeste.numero_teste}
              onChange={(e) => handleNumeroTesteChange(e.target.value)}
              placeholder="5511999999999"
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Enviadas</p><p className="text-lg font-bold">{stats.totalSent}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Recebidas</p><p className="text-lg font-bold">{stats.totalReceived}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Entrega</p><p className="text-lg font-bold">{stats.deliveryRate.toFixed(1)}%</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Erro</p><p className="text-lg font-bold text-destructive">{stats.errorRate.toFixed(1)}%</p></CardContent></Card>
        </div>
      ) : null}
    </div>
  );
}
