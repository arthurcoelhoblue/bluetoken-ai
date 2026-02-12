import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Users } from 'lucide-react';

export default function ContatosPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Users}
        title="Contatos"
        description="Visão unificada de pessoas e contatos. Busca, filtros, deduplicação. Timeline de interações. Vinculação deal-contato."
        patchInfo="Patch 2 — Contatos Unificados"
      />
    </AppLayout>
  );
}
