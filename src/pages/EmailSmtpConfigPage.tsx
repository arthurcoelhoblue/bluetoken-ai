import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Mail,
  Server,
  ShieldCheck,
  TestTube,
  BarChart3,
  Send,
} from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIntegrationHealth } from "@/hooks/useIntegrationHealth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailModoTeste {
  ativo: boolean;
  email_teste: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  encryption: "SSL" | "TLS" | "NONE";
  from_name: string;
  from_email: string;
  reply_to: string;
  max_per_day: number;
  interval_seconds: number;
}

const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: "",
  port: 465,
  encryption: "SSL",
  from_name: "Blue CRM",
  from_email: "",
  reply_to: "",
  max_per_day: 500,
  interval_seconds: 30,
};

const DEFAULT_MODO_TESTE: EmailModoTeste = {
  ativo: true,
  email_teste: "admin@grupoblue.com.br",
};

export default function EmailSmtpConfigPage() {
  const navigate = useNavigate();
  const { isLoading, updateSetting, getSettingValue } = useSystemSettings("email");
  const { checkHealth, getStatus } = useIntegrationHealth();
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

  const modoTeste = getSettingValue<EmailModoTeste>("modo_teste", DEFAULT_MODO_TESTE);
  const smtpConfig = getSettingValue<SmtpConfig>("smtp_config", DEFAULT_SMTP_CONFIG);

  // Local state for fluid typing
  const [localSmtp, setLocalSmtp] = useState<SmtpConfig>(DEFAULT_SMTP_CONFIG);
  const [localModoTeste, setLocalModoTeste] = useState<EmailModoTeste>(DEFAULT_MODO_TESTE);

  useEffect(() => {
    setLocalSmtp(smtpConfig);
  }, [JSON.stringify(smtpConfig)]);

  useEffect(() => {
    setLocalModoTeste(modoTeste);
  }, [JSON.stringify(modoTeste)]);

  const status = getStatus("email");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["email-stats-full"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("lead_messages")
        .select("estado, direcao, created_at")
        .eq("canal", "EMAIL")
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      const sent = data?.filter((m) => m.direcao === "OUTBOUND") || [];
      const delivered = sent.filter(
        (m) => m.estado === "ENVIADO" || m.estado === "ENTREGUE" || m.estado === "LIDO"
      );
      const read = sent.filter((m) => m.estado === "LIDO");
      const errors = sent.filter((m) => m.estado === "ERRO");

      const now = new Date();
      const weeklyData = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);

        const weekSent = sent.filter((m) => {
          const d = new Date(m.created_at);
          return d >= weekStart && d < weekEnd;
        });

        weeklyData.push({
          label: `Sem ${4 - i}`,
          sent: weekSent.length,
          errors: weekSent.filter((m) => m.estado === "ERRO").length,
        });
      }

      return {
        totalSent: sent.length,
        delivered: delivered.length,
        read: read.length,
        errors: errors.length,
        successRate: sent.length > 0 ? (delivered.length / sent.length) * 100 : 0,
        readRate: delivered.length > 0 ? (read.length / delivered.length) * 100 : 0,
        errorRate: sent.length > 0 ? (errors.length / sent.length) * 100 : 0,
        weeklyData,
      };
    },
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await checkHealth("email");
    setIsTesting(false);

    if (result.status === "online") {
      toast.success("Servidor SMTP online!", {
        description: result.latencyMs ? `Latência: ${result.latencyMs}ms` : undefined,
      });
    } else {
      toast.error("Falha na conexão SMTP", { description: result.message });
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient) {
      toast.error("Informe um e-mail destinatário");
      return;
    }
    if (!localSmtp.host || !localSmtp.port) {
      toast.error("Configure o SMTP antes de enviar", {
        description: "Preencha ao menos o host e a porta do servidor SMTP.",
      });
      return;
    }
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-send", {
        body: {
          to: testRecipient,
          subject: "🧪 Teste de E-mail - Blue CRM",
          html: "<h2>Teste de E-mail</h2><p>Se você está lendo isso, o SMTP está funcionando corretamente! 🎉</p><p><small>Enviado pelo Blue CRM</small></p>",
        },
      });
      if (error) throw error;
      if (data?.simulated) {
        toast.warning("Envio simulado (modo teste ativo)", {
          description: "Nenhum e-mail foi enviado de fato. Desative o modo teste para enviar de verdade.",
        });
      } else {
        toast.success("E-mail de teste enviado!", { description: `Para: ${testRecipient}` });
      }
    } catch (err) {
      toast.error("Erro ao enviar e-mail de teste", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggleModoTeste = (ativo: boolean) => {
    const updated = { ...localModoTeste, ativo };
    setLocalModoTeste(updated);
    updateSetting.mutate({ category: "email", key: "modo_teste", value: updated });
  };

  const saveSmtpField = () => {
    updateSetting.mutate({ category: "email", key: "smtp_config", value: localSmtp as unknown as Record<string, unknown> });
  };

  const saveModoTeste = () => {
    updateSetting.mutate({ category: "email", key: "modo_teste", value: localModoTeste as unknown as Record<string, unknown> });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configurações de E-mail</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie SMTP, modo de teste e monitore envios
            </p>
          </div>
        </div>
      </div>

      {/* Connection Status Banner */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {status?.status === "online" && <CheckCircle2 className="h-5 w-5 text-success" />}
            {status?.status === "offline" && <XCircle className="h-5 w-5 text-destructive" />}
            {status?.status === "error" && <AlertTriangle className="h-5 w-5 text-warning" />}
            {status?.status === "checking" && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
            {!status && <div className="h-5 w-5 rounded-full bg-muted" />}
            <div>
              <p className="font-medium">Servidor SMTP</p>
              <p className="text-xs text-muted-foreground">
                {status?.status === "online"
                  ? `Conectado${status.latencyMs ? ` — ${status.latencyMs}ms` : ""}`
                  : status?.status === "offline"
                    ? "Desconectado"
                    : status?.status === "error"
                      ? status.message || "Erro de conexão"
                      : "Não verificado"}
              </p>
            </div>
            {status?.status === "online" && (
              <Badge variant="default" className="bg-success text-success-foreground text-xs">
                Online
              </Badge>
            )}
            {status?.status === "offline" && (
              <Badge variant="destructive" className="text-xs">
                Offline
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verificar Conexão
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* SMTP Server Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Servidor SMTP</CardTitle>
            </div>
            <CardDescription>Configurações do servidor de envio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">Host</Label>
              <Input
                id="smtp_host"
                placeholder="smtp.gmail.com"
                value={localSmtp.host}
                onChange={(e) => setLocalSmtp((s) => ({ ...s, host: e.target.value }))}
                onBlur={saveSmtpField}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_port">Porta SMTP</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={localSmtp.port}
                  onChange={(e) => setLocalSmtp((s) => ({ ...s, port: parseInt(e.target.value) || 465 }))}
                  onBlur={saveSmtpField}
                />
              </div>
              <div className="space-y-2">
                <Label>Criptografia</Label>
                <Select
                  value={localSmtp.encryption}
                  onValueChange={(v) => {
                    const updated = { ...localSmtp, encryption: v as SmtpConfig["encryption"] };
                    setLocalSmtp(updated);
                    updateSetting.mutate({ category: "email", key: "smtp_config", value: updated as unknown as Record<string, unknown> });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSL">SSL/TLS (465)</SelectItem>
                    <SelectItem value="TLS">STARTTLS (587)</SelectItem>
                    <SelectItem value="NONE">Nenhuma (25)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              🔒 Credenciais (usuário/senha) são gerenciadas nos secrets do backend por segurança (SMTP_USER, SMTP_PASS).
            </p>
          </CardContent>
        </Card>

        {/* Sender Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Remetente</CardTitle>
            </div>
            <CardDescription>Identidade do envio de e-mails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="from_name">Nome do remetente</Label>
              <Input
                id="from_name"
                placeholder="Blue CRM"
                value={localSmtp.from_name}
                onChange={(e) => setLocalSmtp((s) => ({ ...s, from_name: e.target.value }))}
                onBlur={saveSmtpField}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from_email">E-mail do remetente</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="noreply@empresa.com"
                value={localSmtp.from_email}
                onChange={(e) => setLocalSmtp((s) => ({ ...s, from_email: e.target.value }))}
                onBlur={saveSmtpField}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply_to">Reply-to (opcional)</Label>
              <Input
                id="reply_to"
                type="email"
                placeholder="contato@empresa.com"
                value={localSmtp.reply_to}
                onChange={(e) => setLocalSmtp((s) => ({ ...s, reply_to: e.target.value }))}
                onBlur={saveSmtpField}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Limites de Envio</CardTitle>
            </div>
            <CardDescription>Controle de frequência para evitar spam</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max_per_day">Máximo por dia</Label>
              <Input
                id="max_per_day"
                type="number"
                value={localSmtp.max_per_day}
                onChange={(e) => setLocalSmtp((s) => ({ ...s, max_per_day: parseInt(e.target.value) || 500 }))}
                onBlur={saveSmtpField}
              />
              <p className="text-xs text-muted-foreground">
                Limite total de e-mails enviados por dia
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval_seconds">Intervalo mínimo (segundos)</Label>
              <Input
                id="interval_seconds"
                type="number"
                value={localSmtp.interval_seconds}
                onChange={(e) => setLocalSmtp((s) => ({ ...s, interval_seconds: parseInt(e.target.value) || 30 }))}
                onBlur={saveSmtpField}
              />
              <p className="text-xs text-muted-foreground">
                Tempo mínimo entre envios consecutivos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Mode */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Modo de Teste</CardTitle>
            </div>
            <CardDescription>Redireciona todos os e-mails para um endereço de teste</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ativar modo de teste</p>
                <p className="text-xs text-muted-foreground">
                  Nenhum e-mail real será enviado a leads
                </p>
              </div>
              <Switch checked={localModoTeste.ativo} onCheckedChange={handleToggleModoTeste} />
            </div>
            {localModoTeste.ativo && (
              <div className="space-y-2">
                <Label htmlFor="email_teste_full">E-mail de redirecionamento</Label>
                <Input
                  id="email_teste_full"
                  type="email"
                  value={localModoTeste.email_teste}
                  onChange={(e) => setLocalModoTeste((s) => ({ ...s, email_teste: e.target.value }))}
                  onBlur={saveModoTeste}
                  placeholder="admin@empresa.com"
                />
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="test_recipient">Enviar e-mail de teste</Label>
              <div className="flex gap-2">
                <Input
                  id="test_recipient"
                  type="email"
                  placeholder="destinatario@exemplo.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest || !testRecipient}
                  className="shrink-0"
                >
                  {isSendingTest ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Estatísticas (últimos 30 dias)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold">{stats.totalSent}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Entregues</p>
                  <p className="text-2xl font-bold text-success">{stats.delivered}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Lidos</p>
                  <p className="text-2xl font-bold text-primary">{stats.read}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Erros</p>
                  <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Taxa Sucesso</p>
                  <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Taxa Leitura</p>
                  <p className="text-2xl font-bold">{stats.readRate.toFixed(1)}%</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Envios por semana</p>
                <div className="grid grid-cols-4 gap-2">
                  {stats.weeklyData.map((w) => (
                    <div key={w.label} className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{w.label}</p>
                      <p className="text-lg font-bold">{w.sent}</p>
                      {w.errors > 0 && (
                        <p className="text-xs text-destructive">{w.errors} erro(s)</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
