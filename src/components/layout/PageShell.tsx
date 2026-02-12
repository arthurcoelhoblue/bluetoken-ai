import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PageShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  patchLabel: string;
}

export function PageShell({ icon: Icon, title, description, patchLabel }: PageShellProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4 animate-fade-in">
      <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Icon className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground max-w-md">{description}</p>
      <Badge variant="secondary" className="mt-2">{patchLabel}</Badge>
    </div>
  );
}
