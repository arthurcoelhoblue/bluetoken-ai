import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge, TrendingUp, TrendingDown } from 'lucide-react';
import type { FC } from 'react';

interface WebVital {
  name: string;
  value: number;
  avg: number;
  rating: string;
  count: number;
}

const THRESHOLDS: Record<string, { good: number; poor: number; unit: string }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: '' },
  INP: { good: 200, poor: 500, unit: 'ms' },
  FCP: { good: 1800, poor: 3000, unit: 'ms' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
};

function getRatingColor(rating: string) {
  switch (rating) {
    case 'good': return 'text-success bg-success/10';
    case 'needs-improvement': return 'text-warning bg-warning/10';
    case 'poor': return 'text-destructive bg-destructive/10';
    default: return 'text-muted-foreground bg-muted';
  }
}

function getRatingLabel(rating: string) {
  switch (rating) {
    case 'good': return 'Bom';
    case 'needs-improvement': return 'Regular';
    case 'poor': return 'Ruim';
    default: return 'N/A';
  }
}

export const WebVitalsCard: FC<{ vitals: WebVital[]; loading?: boolean }> = ({ vitals, loading }) => {
  const coreVitals = ['LCP', 'CLS', 'INP'];
  const otherVitals = ['FCP', 'TTFB'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          Web Vitals (últimas 24h)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : vitals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento de performance registrado (apenas métricas abaixo do ideal são coletadas)</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Core Web Vitals</p>
              <div className="grid grid-cols-3 gap-3">
                {coreVitals.map(name => {
                  const vital = vitals.find(v => v.name === name);
                  const threshold = THRESHOLDS[name];
                  return (
                    <div key={name} className="text-center p-3 rounded-lg border">
                      <p className="text-xs font-medium text-muted-foreground">{name}</p>
                      {vital ? (
                        <>
                          <p className="text-lg font-bold mt-1">
                            {name === 'CLS' ? vital.avg.toFixed(3) : `${Math.round(vital.avg)}${threshold?.unit}`}
                          </p>
                          <Badge className={`mt-1 text-[10px] ${getRatingColor(vital.rating)}`}>
                            {getRatingLabel(vital.rating)}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">{vital.count} amostras</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-2">✓ Bom</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {vitals.some(v => otherVitals.includes(v.name)) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Outras métricas</p>
                <div className="grid grid-cols-2 gap-3">
                  {otherVitals.map(name => {
                    const vital = vitals.find(v => v.name === name);
                    const threshold = THRESHOLDS[name];
                    if (!vital) return null;
                    return (
                      <div key={name} className="flex items-center justify-between p-2 rounded-md border">
                        <span className="text-xs font-medium">{name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{Math.round(vital.avg)}{threshold?.unit}</span>
                          <Badge className={`text-[10px] ${getRatingColor(vital.rating)}`}>
                            {getRatingLabel(vital.rating)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
