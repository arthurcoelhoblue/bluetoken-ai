import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { FC } from 'react';

interface EdgeFnData {
  function_name: string;
  provider: string;
  model: string;
  total: number;
  avg_latency_ms: number;
  errors: number;
  success_rate: number;
}

function getLatencyColor(ms: number) {
  if (ms < 3000) return 'text-success';
  if (ms < 7000) return 'text-warning';
  return 'text-destructive';
}

export const EdgeFunctionLatencyCard: FC<{ data: EdgeFnData[]; loading?: boolean }> = ({ data, loading }) => {
  const totalCalls = data.reduce((s, d) => s + d.total, 0);
  const totalErrors = data.reduce((s, d) => s + d.errors, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Latência Edge Functions (24h)
          {totalCalls > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {totalCalls} chamadas · {totalErrors} erros
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma chamada de IA nas últimas 24h</p>
        ) : (
          <div className="space-y-1.5">
            {data.map(fn => (
              <div key={fn.function_name} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                <div className="flex items-center gap-2 min-w-0">
                  {fn.errors > 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  )}
                  <span className="text-sm font-mono truncate">{fn.function_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-muted-foreground">{fn.total}x</span>
                  <span className={`font-mono font-medium ${getLatencyColor(fn.avg_latency_ms)}`}>
                    {fn.avg_latency_ms > 0 ? `${fn.avg_latency_ms}ms` : '—'}
                  </span>
                  <Badge
                    variant={fn.success_rate === 100 ? 'secondary' : 'destructive'}
                    className="text-[10px] px-1.5"
                  >
                    {fn.success_rate}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
