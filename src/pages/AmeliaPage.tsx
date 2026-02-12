import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Bot } from 'lucide-react';

export default function AmeliaPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Bot}
        title="Amélia IA"
        description="Central da Amélia com ações em massa, qualificação automática e monitoramento de performance da IA."
        patchLabel="Patch 6 — Amélia Ação em Massa"
      />
    </AppLayout>
  );
}
