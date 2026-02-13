import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface FunnelStage {
  stage_nome: string;
  deals_entrada: number;
  valor_entrada: number;
  taxa_conversao: number;
  posicao: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function getBarColor(taxa: number): string {
  if (taxa >= 70) return 'hsl(var(--success))';
  if (taxa >= 40) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

export function FunnelChart({ data, isLoading }: { data?: FunnelStage[]; isLoading: boolean }) {
  if (isLoading) return <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados de funil.</p>;

  const maxDeals = Math.max(...data.map(s => s.deals_entrada), 1);

  return (
    <div className="space-y-2">
      {data.map((stage, i) => {
        const widthPct = (stage.deals_entrada / maxDeals) * 100;
        const isLast = i === data.length - 1;

        return (
          <div key={stage.posicao} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{stage.stage_nome}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{stage.deals_entrada} deals</span>
                <span>{formatCurrency(stage.valor_entrada)}</span>
                {!isLast && (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{ borderColor: getBarColor(stage.taxa_conversao), color: getBarColor(stage.taxa_conversao) }}
                  >
                    {stage.taxa_conversao}% →
                  </Badge>
                )}
              </div>
            </div>
            <div className="h-6 bg-muted rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max(widthPct, 5)}%`,
                  backgroundColor: isLast ? 'hsl(var(--primary))' : getBarColor(stage.taxa_conversao),
                  opacity: 0.8,
                }}
              >
                {widthPct > 15 && (
                  <span className="text-[10px] font-medium text-white">{stage.deals_entrada}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
