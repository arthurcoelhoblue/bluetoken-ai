import { WebhookCard } from "./WebhookCard";
import { WEBHOOKS } from "@/types/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

export function WebhooksTab() {
  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Configure estes endpoints em sistemas externos para integrar com a Amélia. 
          Copie a URL completa e configure a autenticação conforme indicado.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {WEBHOOKS.map((webhook) => (
          <WebhookCard
            key={webhook.id}
            webhook={webhook}
            baseUrl={SUPABASE_URL}
          />
        ))}
      </div>
    </div>
  );
}
