import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { RefreshCcw } from 'lucide-react';

export default function RenovacaoPage() {
  return (
    <AppLayout>
      <PageShell
        icon={RefreshCcw}
        title="Renovação"
        description="Pipeline de renovação com alertas de churn, tracking de contratos e previsão de vencimentos."
        patchLabel="Patch 8 — Renovação & Churn"
      />
    </AppLayout>
  );
}
