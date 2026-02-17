import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { AccessProfileList } from '@/components/settings/AccessProfileList';
import { UserAccessList } from '@/components/settings/UserAccessList';
import { Separator } from '@/components/ui/separator';
import { Shield } from 'lucide-react';

export default function AccessControl() {
  return (
    <AppLayout>
      <PageShell
        icon={Shield}
        title="Controle de Acesso"
        description="Gerencie perfis de acesso e permissões dos usuários"
      />
      <div className="px-6 pb-6 space-y-8">
        <AccessProfileList />
        <Separator />
        <UserAccessList />
      </div>
    </AppLayout>
  );
}
