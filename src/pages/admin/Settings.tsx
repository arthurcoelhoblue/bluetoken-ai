import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { WebhooksTab } from "@/components/settings/WebhooksTab";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { AISettingsTab } from "@/components/settings/AISettingsTab";
import { AccessControlTab } from "@/components/settings/AccessControlTab";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plug, Webhook, Brain, Bot, Shield } from "lucide-react";

export default function Settings() {
  return (
    <AppLayout>
    <div className="container max-w-6xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie integrações, webhooks e parametrizações do sistema
        </p>
      </div>

      <Tabs defaultValue="channels" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none lg:inline-flex">
          <TabsTrigger value="channels" className="gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Canais</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">IA</span>
          </TabsTrigger>
          <TabsTrigger value="amelia" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Amélia</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Acesso</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="ai">
          <AISettingsTab />
        </TabsContent>

        <TabsContent value="amelia">
          <GeneralTab />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>

        <TabsContent value="access">
          <AccessControlTab />
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  );
}
