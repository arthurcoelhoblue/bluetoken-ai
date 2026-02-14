import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCSBenchmarks } from '@/hooks/useCSBenchmarks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

export function CSBenchmarkCard() {
  const { data } = useCSBenchmarks();
  if (!data) return null;

  const csmData = data.porCSM.slice(0, 6).map(c => ({
    name: c.csmNome.split(' ')[0],
    health: c.healthMedio,
    count: c.count,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-chart-5" />
          Benchmarks Internos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* By empresa */}
        {data.porEmpresa.length > 1 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Health por Empresa</p>
            <div className="flex gap-4">
              {data.porEmpresa.map(e => (
                <div key={e.empresa} className="text-center">
                  <p className="text-lg font-bold">{e.healthMedio}</p>
                  <p className="text-xs text-muted-foreground">{e.empresa} ({e.count})</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By CSM */}
        {csmData.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Health por CSM</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={csmData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}/100`} />
                <Bar dataKey="health" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By MRR range */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Health por Faixa MRR</p>
          <div className="flex flex-wrap gap-2">
            {data.porFaixaMRR.map(f => (
              <div key={f.faixa} className="text-center px-3 py-1.5 rounded-lg border">
                <p className="text-sm font-bold">{f.healthMedio}</p>
                <p className="text-[10px] text-muted-foreground">{f.faixa} ({f.count})</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
