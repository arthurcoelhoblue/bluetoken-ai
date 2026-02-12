import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Columns3 } from 'lucide-react';

export default function PipelinePage() {
  return (
    <AppLayout>
      <PageShell
        icon={Columns3}
        title="Pipeline"
        description="Visualize e gerencie seus negócios em um Kanban interativo com drag & drop, estágios customizáveis e métricas de conversão."
        patchLabel="Patch 1 — Pipeline Kanban"
      />
    </AppLayout>
  );
}
