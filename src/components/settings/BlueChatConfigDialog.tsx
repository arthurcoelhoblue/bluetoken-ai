import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIntegrationHealth, HealthCheckResult } from "@/hooks/useIntegrationHealth";
import { toast } from "sonner";

interface BlueChatConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EmpresaTab = 'TOKENIZA' | 'BLUE' | 'MPUPPE' | 'AXIA';

interface CompanyConfig {
  apiUrl: string;
  apiKey: string;
  showApiKey: boolean;
  saving: boolean;
  testing: boolean;
  testResult: HealthCheckResult | null;
}

export function BlueChatConfigDialog({ open, onOpenChange }: BlueChatConfigDialogProps) {
  const { settings, updateSetting } = useSystemSettings("integrations");
  const { checkHealth } = useIntegrationHealth();

  const [configs, setConfigs] = useState<Record<EmpresaTab, CompanyConfig>>({
    TOKENIZA: { apiUrl: "https://chat.grupoblue.com.br/api/external-ai", apiKey: "", showApiKey: false, saving: false, testing: false, testResult: null },
    BLUE: { apiUrl: "", apiKey: "", showApiKey: false, saving: false, testing: false, testResult: null },
    MPUPPE: { apiUrl: "", apiKey: "", showApiKey: false, saving: false, testing: false, testResult: null },
    AXIA: { apiUrl: "", apiKey: "", showApiKey: false, saving: false, testing: false, testResult: null },
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = `${supabaseUrl}/functions/v1/bluechat-inbound`;

  useEffect(() => {
    if (open && settings) {
      const tokenizaSetting = settings.find((s) => s.key === "bluechat_tokeniza");
      const blueSetting = settings.find((s) => s.key === "bluechat_blue");
      const mpuppeSetting = settings.find((s) => s.key === "bluechat_mpuppe");
      const axiaSetting = settings.find((s) => s.key === "bluechat_axia");
      const legacySetting = settings.find((s) => s.key === "bluechat");

      const getValue = (setting: typeof tokenizaSetting, field: string) =>
        (setting?.value as Record<string, unknown>)?.[field] as string || "";

      setConfigs(prev => ({
        TOKENIZA: {
          ...prev.TOKENIZA,
          apiUrl: getValue(tokenizaSetting, 'api_url')
            || getValue(legacySetting, 'api_url')
            || prev.TOKENIZA.apiUrl,
          apiKey: getValue(tokenizaSetting, 'api_key') || getValue(legacySetting, 'api_key'),
        },
        BLUE: {
          ...prev.BLUE,
          apiUrl: getValue(blueSetting, 'api_url') || prev.BLUE.apiUrl,
          apiKey: getValue(blueSetting, 'api_key'),
        },
        MPUPPE: {
          ...prev.MPUPPE,
          apiUrl: getValue(mpuppeSetting, 'api_url') || prev.MPUPPE.apiUrl,
          apiKey: getValue(mpuppeSetting, 'api_key'),
        },
        AXIA: {
          ...prev.AXIA,
          apiUrl: getValue(axiaSetting, 'api_url') || prev.AXIA.apiUrl,
          apiKey: getValue(axiaSetting, 'api_key'),
        },
      }));
    }
  }, [open, settings]);

  const updateConfig = (empresa: EmpresaTab, updates: Partial<CompanyConfig>) => {
    setConfigs(prev => ({ ...prev, [empresa]: { ...prev[empresa], ...updates } }));
  };

  const handleSave = async (empresa: EmpresaTab) => {
    updateConfig(empresa, { saving: true });
    try {
      const SETTINGS_KEY_MAP: Record<EmpresaTab, string> = {
        BLUE: 'bluechat_blue',
        TOKENIZA: 'bluechat_tokeniza',
        MPUPPE: 'bluechat_mpuppe',
        AXIA: 'bluechat_axia',
      };
      const settingsKey = SETTINGS_KEY_MAP[empresa];
      const existing = settings?.find((s) => s.key === settingsKey);
      const current = (existing?.value as Record<string, unknown>) || {};

      const newValue: Record<string, unknown> = {
        ...current,
        api_url: configs[empresa].apiUrl.trim(),
      };

      // Only update api_key if user typed something (don't clear existing)
      const apiKeyValue = configs[empresa].apiKey.trim();
      if (apiKeyValue) {
        newValue.api_key = apiKeyValue;
      }

      await updateSetting.mutateAsync({
        category: "integrations",
        key: settingsKey,
        value: newValue,
      });
    } catch {
      // Error handled by hook
    } finally {
      updateConfig(empresa, { saving: false });
    }
  };

  const handleTest = async (empresa: EmpresaTab) => {
    updateConfig(empresa, { testing: true, testResult: null });
    const result = await checkHealth("bluechat");
    updateConfig(empresa, { testing: false, testResult: result });
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

  const renderCompanyTab = (empresa: EmpresaTab) => {
    const config = configs[empresa];
    return (
      <div className="space-y-4">
        {/* Webhook URL (read-only) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            URL do Webhook (configurar no Blue Chat)
          </Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mesmo endpoint para todas as empresas. A empresa é identificada pelo campo <code>context.empresa</code> do payload.
          </p>
        </div>

        {/* Empresa identifier (read-only) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Identificador da empresa no payload (<code>context.empresa</code>)
          </Label>
          <div className="flex gap-2">
            <Input
              value={empresa}
              readOnly
              className="font-mono text-xs bg-muted text-muted-foreground"
            />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(empresa)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure o Blue Chat para enviar este valor exato no campo <code>context.empresa</code> de cada webhook.
          </p>
        </div>

        {/* Auth note */}
        <Alert className="border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-xs">
            <strong>Autenticação separada por empresa:</strong> Configure a API Key abaixo como o header{" "}
            <code>Authorization: Bearer &lt;api_key&gt;</code> no Blue Chat para esta empresa. Cada empresa deve usar sua própria key.
          </AlertDescription>
        </Alert>

        {/* API URL */}
        <div className="space-y-2">
          <Label htmlFor={`api-url-${empresa}`} className="text-sm font-medium">
            URL da API do Blue Chat ({empresa})
          </Label>
          <Input
            id={`api-url-${empresa}`}
            placeholder="https://chat.grupoblue.com.br/api/external-ai"
            value={config.apiUrl}
            onChange={(e) => updateConfig(empresa, { apiUrl: e.target.value })}
          />
        </div>

        {/* API Key per company */}
        <div className="space-y-2">
          <Label htmlFor={`api-key-${empresa}`} className="text-sm font-medium">
            API Key ({empresa})
          </Label>
          <div className="flex gap-2">
            <Input
              id={`api-key-${empresa}`}
              type={config.showApiKey ? "text" : "password"}
              placeholder="Cole a API key específica desta empresa"
              value={config.apiKey}
              onChange={(e) => updateConfig(empresa, { apiKey: e.target.value })}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateConfig(empresa, { showApiKey: !config.showApiKey })}
            >
              {config.showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Chave de autenticação específica para esta empresa no Blue Chat.
          </p>
        </div>

        {/* Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Cada empresa usa sua própria API Key. A key é armazenada de forma segura no banco de dados.
          </AlertDescription>
        </Alert>

        {/* Test Result */}
        {config.testResult && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Resultado do Teste</span>
              {getStatusBadge(config.testResult)}
            </div>
            {config.testResult.message && (
              <p className="text-xs text-muted-foreground">{config.testResult.message}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => handleTest(empresa)} disabled={config.testing}>
            {config.testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1 h-4 w-4" />}
            Testar
          </Button>
          <Button onClick={() => handleSave(empresa)} disabled={config.saving}>
            {config.saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar Blue Chat</DialogTitle>
          <DialogDescription>
            Configure as conexões do Blue Chat por empresa. Cada empresa tem sua própria API Key e URL.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="TOKENIZA" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="TOKENIZA">Tokeniza</TabsTrigger>
            <TabsTrigger value="BLUE">Blue</TabsTrigger>
            <TabsTrigger value="MPUPPE">MPuppe</TabsTrigger>
            <TabsTrigger value="AXIA">Axia</TabsTrigger>
          </TabsList>

          <TabsContent value="TOKENIZA">
            {renderCompanyTab('TOKENIZA')}
          </TabsContent>

          <TabsContent value="BLUE">
            {renderCompanyTab('BLUE')}
          </TabsContent>

          <TabsContent value="MPUPPE">
            {renderCompanyTab('MPUPPE')}
          </TabsContent>

          <TabsContent value="AXIA">
            {renderCompanyTab('AXIA')}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
