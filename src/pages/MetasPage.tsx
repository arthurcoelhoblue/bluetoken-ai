import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Target } from 'lucide-react';

export default function MetasPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Target}
        title="Metas & Comissões"
        description="Acompanhe metas por vendedor, projeções de resultado e simulador de comissões em tempo real."
        patchLabel="Patch 5 — Metas & Comissões"
      />
    </AppLayout>
  );
}
