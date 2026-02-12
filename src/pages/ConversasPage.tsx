import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { MessageSquare } from 'lucide-react';

export default function ConversasPage() {
  return (
    <AppLayout>
      <PageShell
        icon={MessageSquare}
        title="Conversas"
        description="Chat unificado WhatsApp e Email dentro do CRM. Amélia integrada na conversa. Painel lateral do lead com classificação IA."
        patchInfo="Patch 3 — Conversas Integradas"
      />
    </AppLayout>
  );
}
