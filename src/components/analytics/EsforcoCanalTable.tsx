import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsCanalEsforco } from '@/hooks/useAnalytics';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function isCritico(winRate: number, semAtivPct: number) {
  return (winRate ?? 0) < 5 && (semAtivPct ?? 0) > 30;
}

interface Props {
  pipelineId?: string | null;
}

export function EsforcoCanalTable({ pipelineId }: Props) {
  const { data, isLoading } = useAnalyticsCanalEsforco(pipelineId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Sem dados de canal.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Canal</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Ganhos</TableHead>
          <TableHead className="text-right">Perdidos</TableHead>
          <TableHead className="text-right">Win Rate</TableHead>
          <TableHead className="text-right">Méd. Ativ. (Perdidos)</TableHead>
          <TableHead className="text-right">Sem Ativ. %</TableHead>
          <TableHead className="text-right">Dias Funil</TableHead>
          <TableHead className="text-center">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((c, i) => {
          const critico = isCritico(c.win_rate ?? 0, c.sem_atividade_pct ?? 0);
          return (
            <TableRow key={i} className={critico ? 'bg-destructive/5' : ''}>
              <TableCell className="font-medium">{c.canal}</TableCell>
              <TableCell className="text-right">{c.total_deals}</TableCell>
              <TableCell className="text-right">{c.deals_ganhos}</TableCell>
              <TableCell className="text-right">{c.deals_perdidos}</TableCell>
              <TableCell className="text-right">
                <Badge variant={(c.win_rate ?? 0) >= 50 ? 'default' : 'secondary'}>
                  {(c.win_rate ?? 0).toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="text-right">{(c.media_atividades_perdidos ?? 0).toFixed(1)}</TableCell>
              <TableCell className="text-right">{(c.sem_atividade_pct ?? 0).toFixed(1)}%</TableCell>
              <TableCell className="text-right">{(c.media_dias_funil_perdidos ?? 0).toFixed(1)}d</TableCell>
              <TableCell className="text-center">
                {critico ? (
                  <Badge variant="destructive" className="text-xs">CRÍTICO</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">OK</Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
