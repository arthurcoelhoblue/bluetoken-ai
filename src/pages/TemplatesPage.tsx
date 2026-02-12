import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { FileText } from 'lucide-react';

export default function TemplatesPage() {
  return (
    <AppLayout>
      <PageShell
        icon={FileText}
        title="Templates"
        description="Gerencie templates de mensagens para WhatsApp e Email com preview, variáveis e versionamento."
        patchLabel="Em breve"
      />
    </AppLayout>
  );
}
