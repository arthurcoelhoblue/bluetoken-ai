import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { ContactRound } from 'lucide-react';

export default function ContatosPage() {
  return (
    <AppLayout>
      <PageShell
        icon={ContactRound}
        title="Contatos"
        description="Central unificada de contatos com merge de pessoas, busca inteligente e timeline completa de interações."
        patchLabel="Patch 2 — Contatos Unificados"
      />
    </AppLayout>
  );
}
