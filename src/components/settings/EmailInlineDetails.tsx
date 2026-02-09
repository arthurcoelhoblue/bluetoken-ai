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
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface EmailModoTeste {
  ativo: boolean;
  email_teste: string;
}

export function EmailInlineDetails() {
  const { isLoading, updateSetting, getSettingValue } = useSystemSettings("email");
  const { checkHealth, getStatus } = useIntegrationHealth();
  const [isTesting, setIsTesting] = useState(false);

  const modoTeste = getSettingValue<EmailModoTeste>("modo_teste", {
    ativo: true,
    email_teste: "admin@grupoblue.com.br",
  });

  const status = getStatus("email");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["email-stats"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("lead_messages")
        .select("estado, direcao, created_at")
        .eq("canal", "EMAIL")
        .gte("created_at", sevenDaysAgo.toISOString());

      if (error) throw error;

      const sent = data?.filter((m) => m.direcao === "OUTBOUND") || [];
      const delivered = sent.filter((m) => m.estado === "ENVIADO" || m.estado === "ENTREGUE" || m.estado === "LIDO");
      const errors = sent.filter((m) => m.estado === "ERRO");

      return {
        totalSent: sent.length,
        delivered: delivered.length,
        errors: errors.length,
        successRate: sent.length > 0 ? (delivered.length / sent.length) * 100 : 0,
        errorRate: sent.length > 0 ? (errors.length / sent.length) * 100 : 0,
      };
    },
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await checkHealth("email");
    setIsTesting(false);

    if (result.status === "online") {
      toast.success("SMTP está online!", {
        description: result.latencyMs ? `Latência: ${result.latencyMs}ms` : undefined,
      });
    } else {
      toast.error("Falha na conexão SMTP", { description: result.message });
    }
  };

  const handleToggleModoTeste = (ativo: boolean) => {
    updateSetting.mutate({
      category: "email",
      key: "modo_teste",
      value: { ...modoTeste, ativo },
    });
  };

  const handleEmailTesteChange = (email_teste: string) => {
    updateSetting.mutate({
      category: "email",
      key: "modo_teste",
      value: { ...modoTeste, email_teste },
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
          <span className="text-sm font-medium">Servidor SMTP</span>
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
            <p className="text-xs text-muted-foreground">Redireciona e-mails para endereço de teste</p>
          </div>
          <Switch checked={modoTeste.ativo} onCheckedChange={handleToggleModoTeste} />
        </div>
        {modoTeste.ativo && (
          <div className="space-y-1">
            <Label htmlFor="email_teste" className="text-xs">E-mail de teste</Label>
            <Input
              id="email_teste"
              type="email"
              value={modoTeste.email_teste}
              onChange={(e) => handleEmailTesteChange(e.target.value)}
              placeholder="admin@empresa.com"
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
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Enviados</p><p className="text-lg font-bold">{stats.totalSent}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Entregues</p><p className="text-lg font-bold">{stats.delivered}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sucesso</p><p className="text-lg font-bold">{stats.successRate.toFixed(1)}%</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Erro</p><p className="text-lg font-bold text-destructive">{stats.errorRate.toFixed(1)}%</p></CardContent></Card>
        </div>
      ) : null}
    </div>
  );
}
