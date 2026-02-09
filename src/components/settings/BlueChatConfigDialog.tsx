import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIntegrationHealth, HealthCheckResult } from "@/hooks/useIntegrationHealth";
import { toast } from "sonner";

interface BlueChatConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlueChatConfigDialog({ open, onOpenChange }: BlueChatConfigDialogProps) {
  const { settings, updateSetting } = useSystemSettings("integrations");
  const { checkHealth } = useIntegrationHealth();

  const [apiUrl, setApiUrl] = useState("");
  const [callbackPath, setCallbackPath] = useState("/api/webhook/amelia");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HealthCheckResult | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = `${supabaseUrl}/functions/v1/bluechat-inbound`;

  // Load existing config
  useEffect(() => {
    if (open && settings) {
      const bluechatSetting = settings.find((s) => s.key === "bluechat");
      if (bluechatSetting?.value) {
        const val = bluechatSetting.value as Record<string, unknown>;
        setApiUrl((val.api_url as string) || "");
        setCallbackPath((val.callback_path as string) || "/api/webhook/amelia");
      }
    }
  }, [open, settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const bluechatSetting = settings?.find((s) => s.key === "bluechat");
      const current = (bluechatSetting?.value as Record<string, unknown>) || {};

      await updateSetting.mutateAsync({
        category: "integrations",
        key: "bluechat",
        value: {
          ...current,
          api_url: apiUrl.trim(),
          callback_path: callbackPath.trim(),
        },
      });
    } catch {
      // Error handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await checkHealth("bluechat");
    setTestResult(result);
    setTesting(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const getStatusBadge = (result: HealthCheckResult) => {
    switch (result.status) {
      case "online":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Online
            {result.latencyMs && ` (${result.latencyMs}ms)`}
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" /> Offline
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">
            <AlertTriangle className="mr-1 h-3 w-3" /> Erro
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar Blue Chat</DialogTitle>
          <DialogDescription>
            Configure a integração com o Blue Chat para que a Amélia receba e responda mensagens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Webhook URL (read-only) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              URL do Webhook (configurar no Blue Chat)
            </Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure esta URL no painel do Blue Chat como endpoint de webhook.
              Autenticação via header <code>X-API-Key</code>.
            </p>
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="api-url" className="text-sm font-medium">
              URL da API do Blue Chat
            </Label>
            <Input
              id="api-url"
              placeholder="https://api.bluechat.com.br"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL base da API do Blue Chat para envio de respostas (callback).
            </p>
          </div>

          {/* Callback Path */}
          <div className="space-y-2">
            <Label htmlFor="callback-path" className="text-sm font-medium">
              Caminho do Callback
            </Label>
            <Input
              id="callback-path"
              placeholder="/api/webhook/amelia"
              value={callbackPath}
              onChange={(e) => setCallbackPath(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Path relativo na API do Blue Chat onde as respostas da Amélia são enviadas.
            </p>
          </div>

          {/* Secrets info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              O secret <code>BLUECHAT_API_KEY</code> é usado tanto para autenticar chamadas recebidas
              quanto para enviar callbacks. Gerenciado no ambiente de deploy.
            </AlertDescription>
          </Alert>

          {/* Test Result */}
          {testResult && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Resultado do Teste</span>
                {getStatusBadge(testResult)}
              </div>
              {testResult.message && (
                <p className="text-xs text-muted-foreground">{testResult.message}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-1 h-4 w-4" />
            )}
            Testar Conexão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}