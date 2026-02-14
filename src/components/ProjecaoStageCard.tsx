import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Layers } from 'lucide-react';
import { useAllStageProjections } from '@/hooks/usePatch12';
import type { StageProjection } from '@/types/projection';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  userId?: string;
  empresa?: string;
  metaValor: number;
  vendidoAtual: number;
}

export function ProjecaoStageCard({ userId, empresa, metaValor, vendidoAtual }: Props) {
  const { data: projections = [], isLoading } = useAllStageProjections(empresa);
  const [enabledStages, setEnabledStages] = useState<Set<string>>(new Set());
  const [selectedPipeline, setSelectedPipeline] = useState<string>('ALL');
  const [initialized, setInitialized] = useState(false);

  // Filter by user if provided, else show all
  const userProjections = useMemo(() => {
    let filtered = projections;
    if (userId) filtered = filtered.filter(p => p.owner_id === userId);
    if (selectedPipeline !== 'ALL') filtered = filtered.filter(p => p.pipeline_id === selectedPipeline);
    return filtered;
  }, [projections, userId, selectedPipeline]);

  // Initialize all stages as enabled on first load
  if (!initialized && userProjections.length > 0) {
    setEnabledStages(new Set(userProjections.map(p => p.stage_id)));
    setInitialized(true);
  }

  const pipelines = useMemo(() => {
    const map = new Map<string, string>();
    projections.forEach(p => map.set(p.pipeline_id, p.pipeline_nome));
    return Array.from(map.entries());
  }, [projections]);

  const toggleStage = (stageId: string) => {
    setEnabledStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const totalFunil = userProjections.reduce((s, p) => s + Number(p.valor_total), 0);
  const projecaoSelecionada = userProjections
    .filter(p => enabledStages.has(p.stage_id))
    .reduce((s, p) => s + Number(p.valor_projetado), 0);
  const vendidoMaisProjecao = vendidoAtual + projecaoSelecionada;
  const faltaParaMeta = Math.max(0, metaValor - vendidoMaisProjecao);

  // Bar percentages
  const maxBar = Math.max(metaValor, vendidoMaisProjecao) || 1;
  const pctVendido = (vendidoAtual / maxBar) * 100;
  const pctProjecao = (projecaoSelecionada / maxBar) * 100;
  const pctMeta = (metaValor / maxBar) * 100;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Projeção por Etapa do Funil
          </CardTitle>
          <div className="flex items-center gap-2">
            {pipelines.length > 1 && (
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os pipelines</SelectItem>
                  {pipelines.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEnabledStages(new Set(userProjections.map(p => p.stage_id)))}>Todas</Button>
            <Button variant="ghost" size="sm" onClick={() => setEnabledStages(new Set())}>Nenhuma</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stage toggles */}
        {userProjections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum deal aberto no funil</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {userProjections.map(p => (
              <div key={p.stage_id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Switch
                    checked={enabledStages.has(p.stage_id)}
                    onCheckedChange={() => toggleStage(p.stage_id)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.stage_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.deals_count} deals · {fmt(Number(p.valor_total))}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-xs">{Number(p.taxa_conversao)}%</Badge>
                  <p className="text-xs font-semibold text-primary mt-0.5">{fmt(Number(p.valor_projetado))}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Total no Funil</p>
            <p className="text-sm font-bold">{fmt(totalFunil)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Projeção Selecionada</p>
            <p className="text-sm font-bold text-blue-500">{fmt(projecaoSelecionada)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vendido + Projeção</p>
            <p className="text-sm font-bold">{fmt(vendidoMaisProjecao)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Falta p/ Meta</p>
            <p className="text-sm font-bold text-destructive">{fmt(faltaParaMeta)}</p>
          </div>
        </div>

        {/* Tricolor bar */}
        <div className="relative h-6 rounded-full bg-muted overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-l-full transition-all"
            style={{ width: `${Math.min(pctVendido, 100)}%` }}
          />
          <div
            className="absolute inset-y-0 bg-blue-500 transition-all"
            style={{ left: `${Math.min(pctVendido, 100)}%`, width: `${Math.min(pctProjecao, 100 - pctVendido)}%` }}
          />
          {/* Meta marker */}
          {metaValor > 0 && (
            <div
              className="absolute inset-y-0 w-0.5 bg-destructive z-10"
              style={{ left: `${Math.min(pctMeta, 100)}%` }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-destructive whitespace-nowrap">
                Meta
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Vendido</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Projeção</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-0.5 bg-destructive" /> Meta</span>
        </div>
      </CardContent>
    </Card>
  );
}
