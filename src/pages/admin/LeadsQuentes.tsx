import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadsQuentes, LeadQuente } from "@/hooks/useLeadsQuentes";
import { useNavigate } from "react-router-dom";
import { 
  Flame, 
  User, 
  Phone, 
  Mail, 
  Building2, 
  MessageSquare,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  Thermometer,
  Target,
  Brain
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function LeadCard({ lead }: { lead: LeadQuente }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      navigator.clipboard.writeText(lead.telefone);
      setCopied(true);
      toast.success("Telefone copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTemperaturaBadge = (temp: string | null) => {
    switch (temp) {
      case "QUENTE":
        return <Badge className="bg-destructive">🔥 Quente</Badge>;
      case "MORNO":
        return <Badge className="bg-warning text-warning-foreground">Morno</Badge>;
      case "FRIO":
        return <Badge variant="secondary">Frio</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card 
      className="card-shadow hover-lift cursor-pointer transition-smooth"
      onClick={() => navigate(`/leads/${lead.lead_id}/${lead.empresa}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">
                {lead.nome || `Lead ${lead.lead_id.substring(0, 8)}`}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {lead.empresa}
                <span className="text-xs">•</span>
                <span className="text-xs">
                  {formatDistanceToNow(new Date(lead.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getTemperaturaBadge(lead.temperatura)}
            <Badge variant="outline">
              {lead.acao_recomendada === "CRIAR_TAREFA_CLOSER" ? "Criar Tarefa" : 
               lead.acao_recomendada === "ESCALAR_HUMANO" ? "Escalar" : 
               lead.motivo}
            </Badge>
          </div>
        </div>

        {/* Contact Info */}
        <div className="flex flex-wrap gap-3 mb-3">
          {lead.telefone && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPhone}
              className="gap-1"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <Phone className="h-3 w-3" />
              {lead.telefone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}
            </Button>
          )}
          {lead.email && (
            <Badge variant="secondary" className="gap-1">
              <Mail className="h-3 w-3" />
              {lead.email}
            </Badge>
          )}
        </div>

        {/* Qualification Info */}
        <div className="flex flex-wrap gap-2 mb-3">
          {lead.estado_funil && (
            <Badge variant="secondary" className="gap-1">
              <Target className="h-3 w-3" />
              {lead.estado_funil}
            </Badge>
          )}
          {lead.framework_ativo && lead.framework_ativo !== "NONE" && (
            <Badge variant="secondary" className="gap-1">
              {lead.framework_ativo}
            </Badge>
          )}
          {lead.perfil_disc && (
            <Badge variant="secondary" className="gap-1">
              <Brain className="h-3 w-3" />
              DISC: {lead.perfil_disc}
            </Badge>
          )}
          {lead.icp && (
            <Badge variant="outline" className="text-xs">
              {lead.icp.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>

        {/* Intent Summary */}
        {lead.intent_summary && (
          <div className="p-2 rounded-lg bg-muted/50 mb-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <MessageSquare className="h-3 w-3" />
              Resumo da intenção
            </div>
            <p className="text-sm">{lead.intent_summary}</p>
          </div>
        )}

        {/* Action */}
        <div className="flex justify-end">
          <Button size="sm" className="gap-1">
            Ver Lead
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LeadsQuentes() {
  const { data: leads, isLoading } = useLeadsQuentes();

  return (
    <AppLayout>
      <div className="container max-w-6xl space-y-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Flame className="h-8 w-8 text-warning" />
              Leads Quentes
            </h1>
            <p className="text-muted-foreground">
              Leads que precisam de atenção humana imediata
            </p>
          </div>
          {leads && leads.length > 0 && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {leads.length} pendente{leads.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                Todos
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                🔥 Quentes
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                Criar Tarefa Closer
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                Escalar Humano
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                TOKENIZA
              </Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                BLUE
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : leads && leads.length > 0 ? (
          <div className="grid gap-4">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Flame className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Nenhum lead quente</h2>
              <p className="text-muted-foreground">
                Não há leads aguardando atenção humana no momento. O SDR IA está cuidando de tudo!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
