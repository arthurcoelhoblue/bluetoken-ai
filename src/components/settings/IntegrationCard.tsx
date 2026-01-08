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
import { Switch } from "@/components/ui/switch";
import {
  MessageCircle,
  BarChart3,
  Mail,
  Brain,
  Webhook,
  Send,
  Headphones,
  Settings,
  Check,
  X,
} from "lucide-react";
import { IntegrationInfo, IntegrationConfig } from "@/types/settings";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle,
  BarChart3,
  Mail,
  Brain,
  Webhook,
  Send,
  Headphones,
};

interface IntegrationCardProps {
  integration: IntegrationInfo;
  config: IntegrationConfig | null;
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
  isUpdating?: boolean;
}

export function IntegrationCard({
  integration,
  config,
  onToggle,
  onConfigure,
  isUpdating,
}: IntegrationCardProps) {
  const Icon = iconMap[integration.icon] || Settings;
  const isEnabled = config?.enabled ?? false;
  const hasSecrets = integration.secrets.length > 0;

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              <CardDescription className="text-xs">
                {integration.description}
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={onToggle}
            disabled={isUpdating}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={isEnabled ? "default" : "secondary"}
              className="text-xs"
            >
              {isEnabled ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Ativa
                </>
              ) : (
                <>
                  <X className="mr-1 h-3 w-3" />
                  Inativa
                </>
              )}
            </Badge>
            {hasSecrets && (
              <span className="text-xs text-muted-foreground">
                {integration.secrets.length} secret(s)
              </span>
            )}
          </div>
          {hasSecrets && (
            <Button variant="outline" size="sm" onClick={onConfigure}>
              <Settings className="mr-1 h-3 w-3" />
              Configurar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
