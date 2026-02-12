import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Plug } from 'lucide-react';

export default function IntegracoesPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Plug}
        title="Integrações"
        description="Configure e monitore integrações com WhatsApp, Email, Pipedrive, SGT e outras plataformas."
        patchLabel="Em breve"
      />
    </AppLayout>
  );
}
