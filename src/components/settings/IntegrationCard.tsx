import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { IntegrationInfo, IntegrationConfig } from "@/types/settings";
import { HealthCheckResult } from "@/hooks/useIntegrationHealth";

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
  onTest?: () => void;
  healthStatus?: HealthCheckResult;
  isUpdating?: boolean;
  isTesting?: boolean;
  children?: ReactNode;
}

export function IntegrationCard({
  integration,
  config,
  onToggle,
  onConfigure,
  onTest,
  healthStatus,
  isUpdating,
  isTesting,
  children,
}: IntegrationCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const Icon = iconMap[integration.icon] || Settings;
  const isEnabled = config?.enabled ?? false;
  const hasSecrets = integration.secrets.length > 0;
  const isTestable = integration.testable && onTest;
  const hasDetails = !!children;
  const hasConfigPage = integration.id === "email";

  const getStatusIcon = () => {
    if (!healthStatus) return null;

    switch (healthStatus.status) {
      case "online":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "offline":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "checking":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                  {getStatusIcon()}
                </div>
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
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
              {healthStatus?.latencyMs && healthStatus.status === "online" && (
                <span className="text-xs text-muted-foreground">
                  {healthStatus.latencyMs}ms
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasConfigPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/email-smtp")}
                >
                  <Settings className="mr-1 h-3 w-3" />
                  Configurações
                </Button>
              )}
              {isTestable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTest}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  Testar
                </Button>
              )}
              {hasDetails && (
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ChevronDown className={`mr-1 h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    Detalhes
                  </Button>
                </CollapsibleTrigger>
              )}
              {hasSecrets && !hasDetails && !hasConfigPage && (
                <Button variant="outline" size="sm" onClick={onConfigure}>
                  <Settings className="mr-1 h-3 w-3" />
                  Configurar
                </Button>
              )}
            </div>
          </div>

          {hasDetails && (
            <CollapsibleContent>
              {children}
            </CollapsibleContent>
          )}
        </CardContent>
      </Card>
    </Collapsible>
  );
}
