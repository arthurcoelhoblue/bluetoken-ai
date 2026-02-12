import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Bot } from 'lucide-react';

export default function AmeliaPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Bot}
        title="Amélia IA"
        description="Central de operações da SDR IA. Métricas, conversas ativas. Ação em massa: selecionar leads e acionar Amélia com modelos ou campanhas ad-hoc."
        patchInfo="Patch 6 — Amélia Ação em Massa"
      />
    </AppLayout>
  );
}
