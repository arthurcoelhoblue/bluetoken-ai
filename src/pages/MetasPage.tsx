import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Target } from 'lucide-react';

export default function MetasPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Target}
        title="Metas & Comissões"
        description="Comissão acumulada em tempo real. Projeção por etapa do funil com seleção de stages. Simulador de cenários."
        patchInfo="Patch 5 — Metas & Comissões"
      />
    </AppLayout>
  );
}
