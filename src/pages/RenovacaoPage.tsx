import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Repeat } from 'lucide-react';

export default function RenovacaoPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Repeat}
        title="Renovação & Churn"
        description="Pipeline separado de renovação. Alertas pré-vencimento. Cadências multi-canal automatizadas. Tracking de churn."
        patchInfo="Patch 8 — Renovação & Churn"
      />
    </AppLayout>
  );
}
