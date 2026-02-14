import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Webhook } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookExternoCardProps {
  slug: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

export function WebhookExternoCard({ slug }: WebhookExternoCardProps) {
  const [copied, setCopied] = useState<'url' | 'payload' | null>(null);

  const endpointUrl = `${SUPABASE_URL}/functions/v1/capture-form-submit`;

  const examplePayload = JSON.stringify({
    slug,
    answers: {
      field_nome: "João Silva",
      field_email: "joao@email.com",
      field_telefone: "11999998888",
    },
    metadata: {
      temperatura: "QUENTE",
      comando: "atacar_agora",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "minha-campanha",
      valor_investido: "50000-100000",
    },
  }, null, 2);

  const copyToClipboard = async (text: string, type: 'url' | 'payload') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success('Copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          Webhook Externo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Use esta URL para integrar páginas de vendas externas. Envie um POST com o payload abaixo.
        </p>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-xs bg-muted p-2 rounded break-all select-all">
              {endpointUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => copyToClipboard(endpointUrl, 'url')}
            >
              {copied === 'url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Exemplo de payload</label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => copyToClipboard(examplePayload, 'payload')}
            >
              {copied === 'payload' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              Copiar
            </Button>
          </div>
          <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto max-h-48 overflow-y-auto">
            {examplePayload}
          </pre>
        </div>

        <div className="text-[10px] text-muted-foreground space-y-1">
          <p><strong>temperatura:</strong> FRIO | MORNO | QUENTE</p>
          <p><strong>comando:</strong> atacar_agora (roteia para estágio prioritário)</p>
          <p><strong>UTMs:</strong> utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid</p>
        </div>
      </CardContent>
    </Card>
  );
}
