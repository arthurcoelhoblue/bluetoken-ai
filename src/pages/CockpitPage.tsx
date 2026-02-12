import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Gauge } from 'lucide-react';

export default function CockpitPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Gauge}
        title="Cockpit"
        description="Visão executiva em 30 segundos com funil de vendas, métricas consolidadas e exportação de relatórios."
        patchLabel="Patch 7 — Cockpit Executivo"
      />
    </AppLayout>
  );
}
