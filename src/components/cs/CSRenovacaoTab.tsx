import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, differenceInDays, differenceInMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Trophy, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { CSContractForm } from './CSContractForm';
import { contractStatusConfig } from '@/types/customerSuccess';

interface CSRenovacaoTabProps {
  customerId: string;
  contactId: string;
  empresa: string;
  dataPrimeiroGanho?: string | null;
  proximaRenovacao?: string | null;
  riscoChurnPct?: number | null;
}

interface DealGanho {
  id: string;
  titulo: string;
  valor: number;
  fechado_em: string;
  utm_campaign: string | null;
}

export function CSRenovacaoTab({ customerId, contactId, empresa, dataPrimeiroGanho, proximaRenovacao, riscoChurnPct }: CSRenovacaoTabProps) {
  // Buscar deals GANHOS do contato
  const { data: dealsGanhos } = useQuery({
    queryKey: ['cs-deals-ganhos', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, titulo, valor, fechado_em, utm_campaign')
        .eq('contact_id', contactId)
        .eq('status', 'GANHO')
        .not('fechado_em', 'is', null)
        .order('fechado_em', { ascending: true });
      return (data ?? []) as DealGanho[];
    },
  });

  // Buscar contratos
  const { data: contracts } = useQuery({
    queryKey: ['cs-contracts-renovacao', customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cs_contracts')
        .select('*')
        .eq('customer_id', customerId)
        .order('ano_fiscal', { ascending: true });
      return data ?? [];
    },
  });

  const now = new Date();
  const ultimoGanho = dealsGanhos && dealsGanhos.length > 0 
    ? dealsGanhos[dealsGanhos.length - 1] 
    : null;

  // Elegibilidade: 9 meses após último ganho
  const dataElegibilidade = ultimoGanho?.fechado_em 
    ? addMonths(new Date(ultimoGanho.fechado_em), 9)
    : null;
  const isElegivel = dataElegibilidade ? now >= dataElegibilidade : false;
  const diasParaElegibilidade = dataElegibilidade ? differenceInDays(dataElegibilidade, now) : null;

  // Contrato mais recente
  const contratoAtivo = contracts?.find(c => c.status === 'ATIVO');
  const diasParaVencimento = contratoAtivo?.data_vencimento 
    ? differenceInDays(new Date(contratoAtivo.data_vencimento), now)
    : null;

  // Progresso para elegibilidade (de 0 a 9 meses)
  const progressoElegibilidade = (() => {
    if (!ultimoGanho?.fechado_em) return 0;
    const mesesDesdeGanho = differenceInMonths(now, new Date(ultimoGanho.fechado_em));
    return Math.min(100, (mesesDesdeGanho / 9) * 100);
  })();

  // Status de renovação
  const getStatusRenovacao = () => {
    if (!ultimoGanho) return { label: 'Sem histórico', variant: 'secondary' as const, icon: Clock };
    if (contratoAtivo && diasParaVencimento !== null && diasParaVencimento < 0) return { label: 'Churn potencial', variant: 'destructive' as const, icon: AlertTriangle };
    if (isElegivel) return { label: 'Elegível', variant: 'default' as const, icon: CheckCircle };
    return { label: 'Não elegível', variant: 'secondary' as const, icon: Clock };
  };
  const statusRenovacao = getStatusRenovacao();

  return (
    <div className="space-y-4">
      {/* Status e Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <statusRenovacao.icon className="h-4 w-4" />
              <span className="text-sm font-medium">Status</span>
            </div>
            <Badge variant={statusRenovacao.variant}>{statusRenovacao.label}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Elegibilidade</span>
            </div>
            {dataElegibilidade ? (
              <>
                <Progress value={progressoElegibilidade} className="h-2 mb-1" />
                <p className="text-xs text-muted-foreground">
                  {isElegivel 
                    ? `Elegível desde ${format(dataElegibilidade, 'dd/MM/yyyy')}`
                    : `Faltam ${diasParaElegibilidade} dias (${format(dataElegibilidade, 'dd/MM/yyyy')})`
                  }
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados de ganho</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="h-4 w-4" />
              <span className="text-sm font-medium">Vencimento</span>
            </div>
            {diasParaVencimento !== null ? (
              <div>
                <p className={`text-lg font-bold ${diasParaVencimento < 90 ? 'text-destructive' : ''}`}>
                  {diasParaVencimento > 0 ? `${diasParaVencimento} dias` : `Vencido há ${Math.abs(diasParaVencimento)} dias`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {contratoAtivo?.data_vencimento && format(new Date(contratoAtivo.data_vencimento), 'dd/MM/yyyy')}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem contrato ativo</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {diasParaVencimento !== null && diasParaVencimento < 90 && diasParaVencimento > 0 && (
        <Card className="border-accent/50 bg-accent/10">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-accent-foreground" />
            <div>
              <p className="text-sm font-medium">Renovação próxima</p>
              <p className="text-xs text-muted-foreground">Contrato vence em {diasParaVencimento} dias. Iniciar processo de renovação.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {diasParaVencimento !== null && diasParaVencimento < 0 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Risco de Churn</p>
              <p className="text-xs text-destructive/80">Contrato vencido há {Math.abs(diasParaVencimento)} dias sem renovação.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline de Ganhos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Timeline de Compras ({dealsGanhos?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dealsGanhos && dealsGanhos.length > 0 ? (
            <div className="space-y-3">
              {dealsGanhos.map((deal, index) => {
                const mesesPassados = differenceInMonths(now, new Date(deal.fechado_em));
                return (
                  <div key={deal.id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {index + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{deal.titulo}</span>
                        {deal.utm_campaign && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{deal.utm_campaign}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(deal.fechado_em), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          há {mesesPassados} {mesesPassados === 1 ? 'mês' : 'meses'}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-medium shrink-0">
                      R$ {deal.valor?.toLocaleString('pt-BR') ?? '0'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum deal ganho registrado</p>
          )}
        </CardContent>
      </Card>

      {/* Contratos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Contratos ({contracts?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CSContractForm customerId={customerId} empresa={empresa} />
          {contracts && contracts.length > 0 ? (
            contracts.map(ct => (
              <div key={ct.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center font-bold text-sm">
                    {ct.ano_fiscal}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{ct.plano || 'Sem plano'}</p>
                    <p className="text-xs text-muted-foreground">
                      {ct.data_contratacao ? format(new Date(ct.data_contratacao), 'dd/MM/yyyy') : '—'}
                      {ct.data_vencimento ? ` → ${format(new Date(ct.data_vencimento), 'dd/MM/yyyy')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">R$ {ct.valor?.toLocaleString('pt-BR') ?? '0'}</span>
                  <Badge className={contractStatusConfig[ct.status as keyof typeof contractStatusConfig]?.bgClass || ''}>
                    {contractStatusConfig[ct.status as keyof typeof contractStatusConfig]?.label || ct.status}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum contrato registrado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
