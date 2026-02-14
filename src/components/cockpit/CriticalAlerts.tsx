import { AlertTriangle, UserX, Activity } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Skeleton } from '@/components/ui/skeleton';

interface CriticalAlert {
  tipo: 'sem_atividade' | 'inconsistencia' | 'sem_owner';
  label: string;
  count: number;
  icon: typeof AlertTriangle;
}

export function CriticalAlerts() {
  const { activeCompany } = useCompany();
  const emp = activeCompany === 'ALL' ? null : activeCompany;

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['critical_alerts', emp],
    queryFn: async () => {
      // 1. Deals ativos sem atividade há mais de 24h
      const oneDayAgo = new Date(Date.now() - 86400_000).toISOString();

      // Get active deals
      let dealsQ = supabase
        .from('deals' as any)
        .select('id, titulo, updated_at, owner_id, pipeline_id')
        .eq('status', 'ABERTO');
      const { data: activeDeals } = await dealsQ;

      let filteredDeals = activeDeals ?? [];
      if (emp) {
        const { data: pips } = await supabase
          .from('pipelines' as any)
          .select('id')
          .eq('empresa', emp);
        const pipIds = new Set((pips ?? []).map((p: any) => p.id));
        filteredDeals = filteredDeals.filter((d: any) => pipIds.has(d.pipeline_id));
      }

      // Check which have no activity in 24h
      let semAtividade = 0;
      let semOwner = 0;
      for (const deal of filteredDeals) {
        if (!(deal as any).owner_id) {
          semOwner++;
        }
        const { count } = await supabase
          .from('deal_activities' as any)
          .select('id', { count: 'exact', head: true })
          .eq('deal_id', (deal as any).id)
          .gte('created_at', oneDayAgo);
        if ((count ?? 0) === 0) semAtividade++;
      }

      // 2. Deals perdidos com categoria "esgotado" mas menos de 3 atividades
      let lostQ = supabase
        .from('deals' as any)
        .select('id, pipeline_id')
        .eq('status', 'PERDIDO')
        .eq('categoria_perda_closer', 'ESGOTADO');
      const { data: lostDeals } = await lostQ;
      let filteredLost = lostDeals ?? [];
      if (emp) {
        const { data: pips } = await supabase
          .from('pipelines' as any)
          .select('id')
          .eq('empresa', emp);
        const pipIds = new Set((pips ?? []).map((p: any) => p.id));
        filteredLost = filteredLost.filter((d: any) => pipIds.has(d.pipeline_id));
      }

      let inconsistencia = 0;
      for (const deal of filteredLost) {
        const { count } = await supabase
          .from('deal_activities' as any)
          .select('id', { count: 'exact', head: true })
          .eq('deal_id', (deal as any).id);
        if ((count ?? 0) < 3) inconsistencia++;
      }

      const result: CriticalAlert[] = [];
      if (semAtividade > 0) result.push({ tipo: 'sem_atividade', label: 'Deals sem atividade (24h)', count: semAtividade, icon: Activity });
      if (inconsistencia > 0) result.push({ tipo: 'inconsistencia', label: 'Perdidos "esgotado" com < 3 atividades', count: inconsistencia, icon: AlertTriangle });
      if (semOwner > 0) result.push({ tipo: 'sem_owner', label: 'Deals sem proprietário', count: semOwner, icon: UserX });
      return result;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!alerts?.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {alerts.map((a) => (
        <Alert key={a.tipo} variant="destructive" className="border-destructive/30 bg-destructive/5">
          <a.icon className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2 text-sm">
            {a.label}
            <Badge variant="destructive" className="text-xs">{a.count}</Badge>
          </AlertTitle>
        </Alert>
      ))}
    </div>
  );
}
