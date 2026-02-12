import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { FileText } from 'lucide-react';

export default function TemplatesPage() {
  return (
    <AppLayout>
      <PageShell
        icon={FileText}
        title="Templates"
        description="Biblioteca de templates de mensagens por canal (WhatsApp, Email), empresa e contexto. Placeholders dinâmicos."
        patchInfo="Incluso no Patch 3"
      />
    </AppLayout>
  );
}
