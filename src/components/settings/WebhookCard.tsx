import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, ExternalLink } from "lucide-react";
import { WebhookInfo } from "@/types/settings";
import { toast } from "sonner";

interface WebhookCardProps {
  webhook: WebhookInfo;
  baseUrl: string;
}

export function WebhookCard({ webhook, baseUrl }: WebhookCardProps) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${baseUrl}${webhook.path}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("URL copiada para a área de transferência");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{webhook.name}</CardTitle>
            <CardDescription className="text-xs">
              {webhook.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {webhook.method}
            </Badge>
            <Badge
              variant={webhook.authType === "None" ? "secondary" : "default"}
              className="text-xs"
            >
              {webhook.authType === "None" ? "Público" : webhook.authType}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          <Input
            value={fullUrl}
            readOnly
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        {webhook.secretName && (
          <p className="mt-2 text-xs text-muted-foreground">
            Autenticação via header: <code className="rounded bg-muted px-1">{webhook.authType === "Bearer" ? "Authorization: Bearer" : "X-API-Key"}: {webhook.secretName}</code>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
