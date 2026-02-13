import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface CohortData {
  cohort_mes: string;
  total_deals: number;
  deals_ganhos: number;
  valor_total: number;
  ltv_medio: number;
  win_rate: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

function formatMonth(mes: string) {
  const [y, m] = mes.split('-');
  const names = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(m)]} ${y.slice(2)}`;
}

function heatmapColor(value: number, max: number): string {
  if (max === 0) return 'transparent';
  const ratio = Math.min(value / max, 1);
  const hue = 142; // green
  return `hsl(${hue} 71% ${90 - ratio * 45}%)`;
}

function winRateColor(wr: number): string {
  if (wr >= 50) return 'hsl(142 71% 85%)';
  if (wr >= 30) return 'hsl(38 92% 90%)';
  return 'hsl(0 84% 92%)';
}

export function LTVCohortTable({ data, isLoading }: { data?: CohortData[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-[300px] w-full" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">Sem dados de cohort.</p>;

  const maxLTV = Math.max(...data.map(d => d.ltv_medio), 1);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cohort</TableHead>
            <TableHead className="text-right">Total Deals</TableHead>
            <TableHead className="text-right">Ganhos</TableHead>
            <TableHead className="text-right">Win Rate</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead className="text-right">LTV Médio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(row => (
            <TableRow key={row.cohort_mes}>
              <TableCell className="font-medium">{formatMonth(row.cohort_mes)}</TableCell>
              <TableCell className="text-right">{row.total_deals}</TableCell>
              <TableCell className="text-right">{row.deals_ganhos}</TableCell>
              <TableCell className="text-right">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: winRateColor(row.win_rate) }}
                >
                  {row.win_rate}%
                </span>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(row.valor_total)}</TableCell>
              <TableCell className="text-right">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: heatmapColor(row.ltv_medio, maxLTV) }}
                >
                  {formatCurrency(row.ltv_medio)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
