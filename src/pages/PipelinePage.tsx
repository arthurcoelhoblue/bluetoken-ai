import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Kanban } from 'lucide-react';

export default function PipelinePage() {
  return (
    <AppLayout>
      <PageShell icon={Kanban} title="Pipeline" description="Kanban visual com drag-and-drop. Deals organizados por stages configuráveis por empresa. Filtros por empresa, vendedor, temperatura e canal." patchInfo="Patch 1 — Pipeline Kanban" />
    </AppLayout>
  );
}
