import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, TrendingUp, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { contractStatusConfig, inactivityTierConfig } from '@/types/customerSuccess';

interface CSAportesTabProps {
  customerId: string;
  empresa: string;
}

export function CSAportesTab({ customerId, empresa }: CSAportesTabProps) {
  const { data: contracts } = useQuery({
    queryKey: ['cs-contracts-aportes', customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cs_contracts')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tipo', 'crowdfunding')
        .order('data_contratacao', { ascending: false });
      return data ?? [];
    },
  });

  const now = new Date();
  const totalInvestido = contracts?.reduce((s, c) => s + ((c as any).valor ?? 0), 0) ?? 0;
  const qtd = contracts?.length ?? 0;
  const ticketMedio = qtd > 0 ? Math.round(totalInvestido / qtd) : 0;
  const ultimoAporte = contracts?.[0]?.data_contratacao as string | null;
  const diasSemInvestir = ultimoAporte ? differenceInDays(now, new Date(ultimoAporte)) : null;

  const getInactivityTier = (dias: number | null) => {
    if (dias === null) return null;
    if (dias > 365) return { ...inactivityTierConfig[365], dias };
    if (dias > 180) return { ...inactivityTierConfig[180], dias };
    if (dias > 90) return { ...inactivityTierConfig[90], dias };
    return null;
  };

  const tier = getInactivityTier(diasSemInvestir);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-chart-2" />
              <span className="text-xs text-muted-foreground">Total Investido</span>
            </div>
            <p className="text-lg font-bold">R$ {totalInvestido.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Ticket Médio</span>
            </div>
            <p className="text-lg font-bold">R$ {ticketMedio.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-chart-4" />
              <span className="text-xs text-muted-foreground">Qtd Investimentos</span>
            </div>
            <p className="text-lg font-bold">{qtd}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-chart-5" />
              <span className="text-xs text-muted-foreground">Último Aporte</span>
            </div>
            <p className="text-lg font-bold">
              {ultimoAporte ? format(new Date(ultimoAporte), 'dd/MM/yy') : '—'}
            </p>
            {diasSemInvestir !== null && (
              <p className="text-xs text-muted-foreground">{diasSemInvestir} dias atrás</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inactivity Alert */}
      {tier && (
        <Card className={`border-l-4 ${
          tier.dias > 365 ? 'border-l-destructive bg-destructive/5' :
          tier.dias > 180 ? 'border-l-orange-500 bg-orange-50/50' :
          'border-l-yellow-500 bg-yellow-50/50'
        }`}>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${
              tier.dias > 365 ? 'text-destructive' :
              tier.dias > 180 ? 'text-orange-500' :
              'text-yellow-500'
            }`} />
            <div>
              <p className="text-sm font-medium">
                {tier.dias > 365 ? 'Cliente inativo — potencial churn' :
                 tier.dias > 180 ? 'Inatividade prolongada' :
                 'Alerta de inatividade'}
              </p>
              <p className="text-xs text-muted-foreground">
                Último investimento há {tier.dias} dias.
                {tier.dias > 365 ? ' Considerar como churn.' :
                 ' Entrar em contato para entender a situação.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investment Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Histórico de Investimentos ({qtd})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contracts && contracts.length > 0 ? (
            <div className="space-y-3">
              {contracts.map((ct, index) => (
                <div key={ct.id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {contracts.length - index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {(ct as any).oferta_nome || (ct as any).plano || 'Investimento'}
                      </span>
                      {(ct as any).tipo && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{(ct as any).tipo}</Badge>
                      )}
                      <Badge className={contractStatusConfig[(ct as any).status as keyof typeof contractStatusConfig]?.bgClass || ''}>
                        {contractStatusConfig[(ct as any).status as keyof typeof contractStatusConfig]?.label || (ct as any).status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {ct.data_contratacao ? format(new Date(ct.data_contratacao), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </span>
                      {ct.data_contratacao && (
                        <span className="text-xs text-muted-foreground">
                          há {differenceInDays(now, new Date(ct.data_contratacao))} dias
                        </span>
                      )}
                    </div>
                    {(ct as any).notas && (
                      <p className="text-xs text-muted-foreground mt-1">{(ct as any).notas}</p>
                    )}
                  </div>
                  <span className="text-sm font-medium shrink-0">
                    R$ {((ct as any).valor ?? 0).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum investimento registrado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
