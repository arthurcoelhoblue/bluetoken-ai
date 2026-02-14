import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageShell({ icon: Icon, title, description, children }: PageShellProps) {
  return (
    <div className="flex items-start gap-4 p-6 pb-2 animate-fade-in">
      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-1 flex-1">
        <h2 className="text-xl font-bold leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-lg">{description}</p>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
