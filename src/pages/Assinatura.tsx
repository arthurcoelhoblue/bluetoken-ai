import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Crown, Users, CreditCard, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

const PLAN_LABELS: Record<string, string> = {
  free: "Sem assinatura",
  amelia_full: "Amélia Full",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  past_due: { label: "Pagamento pendente", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "secondary" },
  trialing: { label: "Teste", variant: "outline" },
  inactive: { label: "Inativo", variant: "secondary" },
};

export default function Assinatura() {
  const { subscription, activeUsers, isLoading, refetch } = useSubscriptionLimits();
  const { activeCompany } = useCompany();
  const selectedEmpresa = activeCompany?.id;
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Assinatura ativada com sucesso!");
      refetch();
    } else if (searchParams.get("cancelled") === "true") {
      toast.info("Checkout cancelado.");
    }
  }, [searchParams, refetch]);

  const handleCheckout = async (extraUsers = 0) => {
    setLoadingCheckout(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { plan: "amelia_full", empresa: selectedEmpresa, extra_users: extraUsers },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar checkout");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handlePortal = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir portal");
    } finally {
      setLoadingPortal(false);
    }
  };

  const usagePercent = subscription.user_limit > 0
    ? Math.min(100, (activeUsers / subscription.user_limit) * 100)
    : 0;

  const isActive = subscription.status === "active" || subscription.status === "trialing";
  const statusConfig = STATUS_CONFIG[subscription.status] || STATUS_CONFIG.inactive;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Assinatura</h1>
        </div>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{PLAN_LABELS[subscription.plan] || subscription.plan}</CardTitle>
                <CardDescription>
                  {isActive
                    ? `Válido até ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR") : "—"}`
                    : "Nenhuma assinatura ativa"}
                </CardDescription>
              </div>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" /> Usuários
                </span>
                <span className="font-medium text-foreground">
                  {activeUsers} / {subscription.user_limit}
                </span>
              </div>
              <Progress value={usagePercent} className="h-2" />
              {usagePercent >= 90 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Próximo do limite de usuários
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {isActive ? (
                <>
                  <Button onClick={handlePortal} disabled={loadingPortal} variant="outline" className="gap-2">
                    <CreditCard className="h-4 w-4" />
                    {loadingPortal ? "Abrindo..." : "Gerenciar Assinatura"}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button onClick={() => handleCheckout(1)} disabled={loadingCheckout} variant="secondary" className="gap-2">
                    <Users className="h-4 w-4" />
                    {loadingCheckout ? "..." : "Adicionar Usuário (+R$ 180/mês)"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => handleCheckout(0)} disabled={loadingCheckout} className="gap-2">
                  <Crown className="h-4 w-4" />
                  {loadingCheckout ? "Carregando..." : "Assinar Amélia Full — R$ 999/mês"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Amélia Full</CardTitle>
            <CardDescription>Tudo que você precisa para escalar sua operação comercial</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {[
                "CRM completo com pipelines ilimitados",
                "Amélia IA — SDR automatizada com WhatsApp",
                "Copilot para vendedores",
                "Customer Success integrado",
                "Cadências multicanal (WhatsApp, email, telefonia)",
                "Relatórios e analytics executivos",
                "Gamificação e metas",
                "Integrações (WhatsApp, Pipedrive, Zadarma, Meta)",
                "1 usuário incluso + R$ 180/mês por adicional",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
