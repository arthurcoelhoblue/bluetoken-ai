import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useResolutionStats } from '@/hooks/useResolutionStats';
import { ShieldCheck, UserCheck, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function ResolutionStatsCard() {
  const { data, isLoading } = useResolutionStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalConversas === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Resolução Autônoma</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sem dados de resolução no período.</p>
        </CardContent>
      </Card>
    );
  }

  const last7 = data.dailyStats.slice(-7);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Resolução Autônoma</CardTitle>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">
          {data.taxaResolucao}%
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <ShieldCheck className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{data.totalConversas}</p>
            <p className="text-xs text-muted-foreground">Conversas</p>
          </div>
          <div className="rounded-lg border p-3 text-center border-green-500/30 bg-green-500/5">
            <UserCheck className="mx-auto h-4 w-4 text-green-600 mb-1" />
            <p className="text-lg font-bold text-green-600">{data.totalAutonomas}</p>
            <p className="text-xs text-muted-foreground">Autônomas</p>
          </div>
          <div className="rounded-lg border p-3 text-center border-amber-500/30 bg-amber-500/5">
            <ArrowUpRight className="mx-auto h-4 w-4 text-amber-600 mb-1" />
            <p className="text-lg font-bold text-amber-600">{data.totalEscaladas}</p>
            <p className="text-xs text-muted-foreground">Escaladas</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="autonomas" name="Autônomas" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="escaladas" name="Escaladas" stackId="a" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
