import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { MessagesSquare } from 'lucide-react';

export default function ConversasPage() {
  return (
    <AppLayout>
      <PageShell
        icon={MessagesSquare}
        title="Conversas"
        description="Chat integrado com WhatsApp e Email dentro do CRM. Gerencie todas as conversas em um só lugar."
        patchLabel="Patch 3 — Conversas Integradas"
      />
    </AppLayout>
  );
}
