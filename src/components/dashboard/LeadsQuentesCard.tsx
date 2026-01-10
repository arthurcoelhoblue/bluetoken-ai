import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadsQuentes } from "@/hooks/useLeadsQuentes";
import { useNavigate } from "react-router-dom";
import { Flame, ArrowRight, User, Phone, Building2 } from "lucide-react";

export function LeadsQuentesCard() {
  const { data: leads, isLoading } = useLeadsQuentes();
  const navigate = useNavigate();

  const recentLeads = leads?.slice(0, 3) || [];

  if (isLoading) {
    return (
      <Card className="card-shadow">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const count = leads?.length || 0;

  return (
    <Card className={`card-shadow ${count > 0 ? 'border-warning bg-warning/5' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className={`h-5 w-5 ${count > 0 ? 'text-warning animate-pulse' : 'text-muted-foreground'}`} />
            Leads Quentes
          </CardTitle>
          {count > 0 && (
            <Badge variant="destructive" className="bg-warning text-warning-foreground">
              {count}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum lead aguardando atenção humana no momento.
          </p>
        ) : (
          <>
            {recentLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-smooth"
                onClick={() => navigate(`/leads/${lead.lead_id}/${lead.empresa}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm">
                      {lead.nome || lead.lead_id.substring(0, 8)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {lead.empresa}
                      {lead.telefone && (
                        <>
                          <Phone className="h-3 w-3 ml-1" />
                          {lead.telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {lead.acao_recomendada === "CRIAR_TAREFA_CLOSER" ? "Closer" : 
                   lead.acao_recomendada === "ESCALAR_HUMANO" ? "Escalar" : "Quente"}
                </Badge>
              </div>
            ))}

            {count > 3 && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => navigate("/admin/leads-quentes")}
              >
                Ver todos ({count})
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
