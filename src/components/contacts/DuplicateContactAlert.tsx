import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DuplicateMatch } from '@/hooks/useContactDuplicateCheck';

interface Props {
  duplicates: DuplicateMatch[];
  onViewContact: (id: string) => void;
  onForceCreate: () => void;
  isPending?: boolean;
}

export function DuplicateContactAlert({ duplicates, onViewContact, onForceCreate, isPending }: Props) {
  if (!duplicates.length) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3">
      <div className="flex items-center gap-2 text-destructive font-medium text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Possível contato duplicado encontrado</span>
      </div>

      <div className="space-y-2">
        {duplicates.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 text-sm bg-background/60 rounded-md px-3 py-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{d.nome}</p>
              <p className="text-muted-foreground text-xs truncate">
                {[d.email, d.telefone].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => onViewContact(d.id)}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Ver
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onForceCreate}
        disabled={isPending}
      >
        Criar mesmo assim
      </Button>
    </div>
  );
}
