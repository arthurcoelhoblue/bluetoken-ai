import { useState } from "react";
import { ElementorIntegrationManager } from "./ElementorIntegrationManager";
import { WEBHOOKS, WebhookInfo } from "@/types/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Info, ChevronRight, Webhook, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

function WebhookDetail({ webhook, onBack }: { webhook: WebhookInfo; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${SUPABASE_URL}${webhook.path}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("URL copiada");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à lista
      </button>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{webhook.name}</h3>
          <Badge variant="outline" className="text-xs">{webhook.method}</Badge>
          <Badge variant={webhook.authType === "None" ? "secondary" : "default"} className="text-xs">
            {webhook.authType === "None" ? "Público" : webhook.authType}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{webhook.description}</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">URL do Endpoint</label>
        <div className="flex items-center gap-2">
          <Input value={fullUrl} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {webhook.secretName && (
        <div className="rounded-md border bg-muted/50 p-3 space-y-1">
          <p className="text-sm font-medium">Autenticação</p>
          <p className="text-xs text-muted-foreground">
            Header: <code className="rounded bg-muted px-1.5 py-0.5">
              {webhook.authType === "Bearer" ? "Authorization: Bearer" : "X-API-Key"}: {webhook.secretName}
            </code>
          </p>
        </div>
      )}

      {/* Elementor-specific config */}
      {webhook.id === "elementor-webhook" && (
        <div className="pt-2">
          <ElementorIntegrationManager />
        </div>
      )}
    </div>
  );
}

export function WebhooksTab() {
  const [selected, setSelected] = useState<WebhookInfo | null>(null);

  if (selected) {
    return (
      <div className="space-y-4">
        <WebhookDetail webhook={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Selecione uma integração para ver o endpoint e as configurações.
        </AlertDescription>
      </Alert>

      <div className="rounded-md border divide-y">
        {WEBHOOKS.map((webhook) => (
          <button
            key={webhook.id}
            onClick={() => setSelected(webhook)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-4 py-3 text-left",
              "hover:bg-muted/50 transition-colors"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Webhook className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{webhook.name}</p>
                <p className="text-xs text-muted-foreground truncate">{webhook.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs hidden sm:inline-flex">{webhook.method}</Badge>
              <Badge variant={webhook.authType === "None" ? "secondary" : "default"} className="text-xs hidden sm:inline-flex">
                {webhook.authType === "None" ? "Público" : webhook.authType}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
