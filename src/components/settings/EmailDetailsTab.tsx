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
import { Mail, CheckCircle2, XCircle, Loader2, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface EmailModoTeste {
  ativo: boolean;
  email_teste: string;
}

export function EmailDetailsTab() {
  const { isLoading, updateSetting, getSettingValue } = useSystemSettings("email");
  const { checkHealth, getStatus } = useIntegrationHealth();
  const [isTesting, setIsTesting] = useState(false);

  const modoTeste = getSettingValue<EmailModoTeste>("modo_teste", {
    ativo: true,
    email_teste: "admin@grupoblue.com.br",
  });

  const status = getStatus("email");

  // Email stats from last 7 days
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
      toast.error("Falha na conexão SMTP", {
        description: result.message,
      });
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
            <Mail className="h-5 w-5" />
            Status da Conexão SMTP
          </CardTitle>
          <CardDescription>
            Verifique se a integração com o servidor de e-mail está funcionando.
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
                <span className="font-medium">Servidor SMTP</span>
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
            Quando ativado, todos os e-mails serão enviados apenas para o endereço de teste.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Modo de teste ativo</Label>
              <p className="text-sm text-muted-foreground">
                Redireciona todos os e-mails para o endereço de teste
              </p>
            </div>
            <Switch
              checked={modoTeste.ativo}
              onCheckedChange={handleToggleModoTeste}
            />
          </div>

          {modoTeste.ativo && (
            <div className="space-y-2">
              <Label htmlFor="email_teste">E-mail de teste</Label>
              <Input
                id="email_teste"
                type="email"
                value={modoTeste.email_teste}
                onChange={(e) => handleEmailTesteChange(e.target.value)}
                placeholder="admin@empresa.com"
              />
              <p className="text-xs text-muted-foreground">
                Todos os e-mails serão redirecionados para este endereço
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
                  <p className="text-sm text-muted-foreground">Total Enviados</p>
                  <p className="text-2xl font-bold">{stats.totalSent}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Entregues</p>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
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
