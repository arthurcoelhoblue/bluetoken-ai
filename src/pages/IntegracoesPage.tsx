import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Webhook } from 'lucide-react';

export default function IntegracoesPage() {
  return (
    <AppLayout>
      <PageShell
        icon={Webhook}
        title="Integrações"
        description="Status e configuração de SGT, Pipedrive, WhatsApp, Email SMTP, Mautic, Tokeniza, Notion e mais."
      />
    </AppLayout>
  );
}
