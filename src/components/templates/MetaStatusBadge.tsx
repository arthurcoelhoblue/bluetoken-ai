import { Badge } from '@/components/ui/badge';
import type { MetaStatus } from '@/hooks/useTemplates';

const statusConfig: Record<MetaStatus, { label: string; className: string }> = {
  LOCAL: { label: 'Local', className: 'bg-muted text-muted-foreground' },
  PENDING: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  APPROVED: { label: 'Aprovado', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  REJECTED: { label: 'Rejeitado', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  PAUSED: { label: 'Pausado', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  DISABLED: { label: 'Desativado', className: 'bg-muted text-muted-foreground' },
};

interface Props {
  status: MetaStatus;
  rejectedReason?: string | null;
}

export function MetaStatusBadge({ status, rejectedReason }: Props) {
  const cfg = statusConfig[status] || statusConfig.LOCAL;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Badge variant="outline" className={cfg.className}>
        {cfg.label}
      </Badge>
      {status === 'REJECTED' && rejectedReason && (
        <span className="text-[10px] text-destructive max-w-[150px] truncate" title={rejectedReason}>
          {rejectedReason}
        </span>
      )}
    </span>
  );
}
