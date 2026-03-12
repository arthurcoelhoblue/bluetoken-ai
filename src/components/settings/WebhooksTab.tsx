import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ElementorIntegrationManager } from "./ElementorIntegrationManager";
import { WEBHOOKS, WebhookInfo } from "@/types/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Info, ChevronRight, Webhook, ArrowLeft, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTokenizaOffers } from "@/hooks/useTokenizaOffers";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

const EMPRESAS = ['BLUE', 'TOKENIZA', 'MPUPPE', 'AXIA'] as const;

function useWebhookTagConfigs(webhookId: string) {
  return useQuery({
    queryKey: ['webhook-tag-configs', webhookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_tag_configs' as any)
        .select('*')
        .eq('webhook_id', webhookId);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; webhook_id: string; empresa: string; tag: string }[];
    },
  });
}

function useUpsertWebhookTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { webhookId: string; empresa: string; tag: string }) => {
      const { error } = await supabase
        .from('webhook_tag_configs' as any)
        .upsert([{
          webhook_id: params.webhookId,
          empresa: params.empresa,
          tag: params.tag,
          updated_at: new Date().toISOString(),
        }], { onConflict: 'webhook_id,empresa' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['webhook-tag-configs', vars.webhookId] });
      toast.success('Tag salva com sucesso');
    },
    onError: () => toast.error('Erro ao salvar tag'),
  });
}

function WebhookTagConfig({ webhookId }: { webhookId: string }) {
  const { data: configs = [], isLoading } = useWebhookTagConfigs(webhookId);
  const { activeOffers } = useActiveTokenizaOffers();
  const upsert = useUpsertWebhookTag();
  const [localTags, setLocalTags] = useState<Record<string, string>>({});

  const availableTags = activeOffers.map(o => o.nome);

  const getTagForEmpresa = (empresa: string) => {
    if (localTags[empresa] !== undefined) return localTags[empresa];
    const config = configs.find(c => c.empresa === empresa);
    return config?.tag || '';
  };

  const handleSave = (empresa: string) => {
    const tag = getTagForEmpresa(empresa);
    upsert.mutate({ webhookId, empresa, tag });
  };

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Tag por Empresa</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Leads que entrarem por este webhook serão automaticamente marcados com a tag selecionada. 
        A mesma tag pode ser usada para filtrar no Pipeline.
      </p>
      <div className="space-y-2">
        {EMPRESAS.map(empresa => {
          const currentTag = getTagForEmpresa(empresa);
          const savedTag = configs.find(c => c.empresa === empresa)?.tag || '';
          const hasChanges = localTags[empresa] !== undefined && localTags[empresa] !== savedTag;

          return (
            <div key={empresa} className="flex items-center gap-2">
              <Badge variant="outline" className="w-24 justify-center text-xs shrink-0">
                {empresa}
              </Badge>
              <Select
                value={currentTag || 'none'}
                onValueChange={v => setLocalTags(prev => ({ ...prev, [empresa]: v === 'none' ? '' : v }))}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Nenhuma tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma tag</SelectItem>
                  {availableTags.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={!hasChanges || upsert.isPending}
                onClick={() => handleSave(empresa)}
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

      {/* Tag config per empresa */}
      <div className="rounded-md border p-4">
        <WebhookTagConfig webhookId={webhook.id} />
      </div>

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
