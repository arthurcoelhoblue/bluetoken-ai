import { AppLayout } from "@/components/layout/AppLayout";
import { TokenizaOffersList } from "@/components/tokeniza/TokenizaOffersList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveTokenizaOffers } from "@/hooks/useTokenizaOffers";
import { TrendingUp, Target, DollarSign, Clock } from "lucide-react";

export default function TokenizaOffersPage() {
  const { summary, isLoading } = useActiveTokenizaOffers();

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Ofertas Tokeniza</h1>
          <p className="text-muted-foreground">
            Ofertas de crowdfunding disponíveis na plataforma Tokeniza
          </p>
        </div>

        {/* Summary Cards */}
        {summary && !isLoading && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ofertas Abertas</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.ofertasAbertas}</div>
                <p className="text-xs text-muted-foreground">
                  de {summary.totalOfertas} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Maior Rentabilidade</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summary.maiorRentabilidade}%
                </div>
                <p className="text-xs text-muted-foreground">ao ano</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Investimento Mínimo</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {summary.menorContribuicao.toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground">menor aporte</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Atualização</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Tempo Real</div>
                <p className="text-xs text-muted-foreground">dados da API</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Offers List */}
        <TokenizaOffersList />
      </div>
    </AppLayout>
  );
}
