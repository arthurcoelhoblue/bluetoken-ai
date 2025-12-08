import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveTokenizaOffers } from "@/hooks/useTokenizaOffers";
import { TrendingUp, Clock, DollarSign, AlertCircle, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TokenizaOffersList() {
  const { activeOffers, summary, isLoading, error, data } = useActiveTokenizaOffers();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-sm text-destructive">
            Erro ao carregar ofertas: {error.message}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (activeOffers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhuma oferta aberta no momento.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{summary.ofertasAbertas} ofertas abertas</span>
          <span>•</span>
          <span>Até {summary.maiorRentabilidade}% de rentabilidade</span>
          <span>•</span>
          <span>A partir de R$ {summary.menorContribuicao.toLocaleString('pt-BR')}</span>
        </div>
      )}

      {/* Offers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeOffers.map((offer) => (
          <Card key={offer.id} className="overflow-hidden hover:shadow-md transition-shadow">
            {/* Image */}
            {offer.imagem && (
              <div className="relative h-32 overflow-hidden bg-muted">
                <img
                  src={offer.imagem}
                  alt={offer.nome}
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-2 right-2 bg-primary/90">
                  {offer.tipo}
                </Badge>
              </div>
            )}

            <CardHeader className="pb-2">
              <CardTitle className="text-base line-clamp-2">{offer.nome}</CardTitle>
              <p className="text-xs text-muted-foreground">{offer.empresa}</p>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  <span className="font-semibold text-green-600">{offer.rentabilidade}%</span>
                  <span className="text-muted-foreground text-xs">rentab.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{offer.duracaoDias} dias</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Mín. R$ {offer.contribuicaoMinima.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Captação</span>
                  <span className="font-medium">{offer.percentualCaptado}%</span>
                </div>
                <Progress value={offer.percentualCaptado} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>R$ {offer.valorCaptado.toLocaleString('pt-BR')}</span>
                  <span>Meta: R$ {offer.metaCaptacao.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              {/* Deadline */}
              {offer.diasRestantes > 0 && (
                <div className="text-xs text-muted-foreground">
                  {offer.diasRestantes} dias restantes
                </div>
              )}

              {/* Link */}
              {offer.empresaWebsite && (
                <a
                  href={offer.empresaWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Ver projeto <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Last update */}
      {data?.atualizadoEm && (
        <p className="text-xs text-muted-foreground text-right">
          Atualizado {formatDistanceToNow(new Date(data.atualizadoEm), { addSuffix: true, locale: ptBR })}
        </p>
      )}
    </div>
  );
}
