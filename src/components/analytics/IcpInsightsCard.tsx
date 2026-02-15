import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Target, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface IcpProfile {
  narrative: string;
  patterns: {
    won: { topSectors: { name: string }[]; topRoles: { name: string }[] };
    lost: { topLossReasons: { name: string }[] };
  };
}

export function IcpInsightsCard() {
  const [icp, setIcp] = useState<IcpProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadIcp();
  }, []);

  async function loadIcp() {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "icp_profile")
        .maybeSingle();
      if (data?.value) setIcp(data.value as unknown as IcpProfile);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculate() {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("icp-learner", {});
      if (error) throw error;
      if (data?.icpNarrative) {
        toast.success("ICP recalculado com sucesso!");
        loadIcp();
      } else {
        toast.info("Dados insuficientes para calcular ICP");
      }
    } catch {
      toast.error("Erro ao calcular ICP");
    } finally {
      setCalculating(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Perfil de Cliente Ideal (ICP)
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={handleCalculate} disabled={calculating}>
          <RefreshCw className={`h-4 w-4 ${calculating ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {icp ? (
          <>
            <p className="text-sm text-muted-foreground">{icp.narrative}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold flex items-center gap-1.5 text-success">
                  <Target className="h-3.5 w-3.5" /> Foco (Ganhos)
                </h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {icp.patterns.won.topSectors?.slice(0, 3).map((s, i) => (
                    <li key={i}>• {s.name}</li>
                  ))}
                  {icp.patterns.won.topRoles?.slice(0, 3).map((r, i) => (
                    <li key={i}>• {r.name}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Red Flags (Perdas)
                </h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {icp.patterns.lost.topLossReasons?.slice(0, 3).map((r, i) => (
                    <li key={i}>• {r.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm mb-4">Ainda não há inteligência de ICP gerada.</p>
            <Button onClick={handleCalculate} disabled={calculating}>
              Gerar ICP Agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
