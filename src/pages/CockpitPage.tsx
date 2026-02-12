import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { BarChart3 } from 'lucide-react';

export default function CockpitPage() {
  return (
    <AppLayout>
      <PageShell
        icon={BarChart3}
        title="Cockpit Executivo"
        description="Visão gerencial em 30 segundos. NB vs Renovação, conversão, CAC por canal, SLA compliance. Dados via SGT."
        patchInfo="Patch 7 — Cockpit & Dashboards"
      />
    </AppLayout>
  );
}
