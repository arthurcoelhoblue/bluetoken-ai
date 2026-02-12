import { Separator } from '@/components/ui/separator';
import { AccessProfileList } from './AccessProfileList';
import { UserAccessList } from './UserAccessList';

export function AccessControlTab() {
  return (
    <div className="space-y-8">
      <AccessProfileList />
      <Separator />
      <UserAccessList />
    </div>
  );
}
