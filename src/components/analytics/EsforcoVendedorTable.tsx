import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsEsforco } from '@/hooks/useAnalytics';

function semaforoColor(media: number) {
  if (media >= 5) return 'bg-emerald-500';
  if (media >= 3) return 'bg-amber-500';
  return 'bg-destructive';
}

function semaforoLabel(media: number) {
  if (media >= 5) return 'Alto';
  if (media >= 3) return 'Médio';
  return 'Baixo';
}

export function EsforcoVendedorTable() {
  const { data, isLoading } = useAnalyticsEsforco();

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Sem dados de esforço.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendedor</TableHead>
          <TableHead className="text-right">Perdidos</TableHead>
          <TableHead className="text-right">Média Ativ.</TableHead>
          <TableHead className="text-right">Sem Ativ. %</TableHead>
          <TableHead className="text-right">Dias no Funil</TableHead>
          <TableHead className="text-right">&lt;24h</TableHead>
          <TableHead className="text-center">Esforço</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((v) => {
          const media = v.media_atividades ?? 0;
          const destaque = (v.sem_atividade_pct ?? 0) > 20;
          return (
            <TableRow key={v.user_id} className={destaque ? 'bg-destructive/5' : ''}>
              <TableCell className="font-medium">{v.vendedor_nome}</TableCell>
              <TableCell className="text-right">{v.total_perdidos}</TableCell>
              <TableCell className="text-right">{media.toFixed(1)}</TableCell>
              <TableCell className="text-right">
                {(v.sem_atividade_pct ?? 0).toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">{(v.media_dias_funil ?? 0).toFixed(1)}d</TableCell>
              <TableCell className="text-right">{v.perdidos_menos_24h}</TableCell>
              <TableCell className="text-center">
                <Badge className={`${semaforoColor(media)} text-white text-xs`}>
                  {semaforoLabel(media)}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
