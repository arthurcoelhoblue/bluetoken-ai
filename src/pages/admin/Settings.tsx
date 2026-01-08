import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { WebhooksTab } from "@/components/settings/WebhooksTab";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { AISettingsTab } from "@/components/settings/AISettingsTab";
import { WhatsAppDetailsTab } from "@/components/settings/WhatsAppDetailsTab";
import { Plug, Webhook, SlidersHorizontal, Brain, MessageCircle } from "lucide-react";

export default function Settings() {
  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie integrações, webhooks e parametrizações do sistema
        </p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none lg:inline-flex">
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Integrações</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">IA</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="ai">
          <AISettingsTab />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppDetailsTab />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>

        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
