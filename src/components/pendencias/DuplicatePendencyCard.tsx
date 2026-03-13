import { useState } from 'react';
import { Copy, Check, X, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { DuplicatePendency } from '@/hooks/useDuplicatePendencies';
import { useResolveDuplicate } from '@/hooks/useDuplicatePendencies';

const MATCH_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  TELEFONE: 'Telefone',
  EMAIL_E_TELEFONE: 'Email e Telefone',
};

interface DuplicatePendencyCardProps {
  pendency: DuplicatePendency;
  onDealClick?: (dealId: string) => void;
}

export function DuplicatePendencyCard({ pendency, onDealClick }: DuplicatePendencyCardProps) {
  const resolve = useResolveDuplicate();

  const handleAction = (action: 'MERGED' | 'KEPT_SEPARATE' | 'DISMISSED') => {
    const labels = { MERGED: 'Mesclado', KEPT_SEPARATE: 'Mantidos separados', DISMISSED: 'Dispensado' };
    resolve.mutate({ id: pendency.id, action }, {
      onSuccess: () => toast.success(labels[action]),
    });
  };

  const newContact = pendency.new_contact;
  const existingContact = pendency.existing_contact;

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {newContact?.nome ?? 'Novo lead'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {newContact?.email} • {new Date(pendency.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
            <Copy className="h-3 w-3 mr-1" />
            {MATCH_LABELS[pendency.match_type] ?? pendency.match_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border bg-card space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Novo contato</p>
            <p className="text-sm font-medium">{newContact?.nome ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{newContact?.email ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{newContact?.telefone ?? '—'}</p>
            {pendency.new_deal && (
              <p className="text-xs mt-1">Deal: {pendency.new_deal.titulo}</p>
            )}
          </div>
          <div className="p-3 rounded-lg border bg-card space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Contato existente</p>
            <p className="text-sm font-medium">{existingContact?.nome ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{existingContact?.email ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{existingContact?.telefone ?? '—'}</p>
            {pendency.existing_deal && (
              <p className="text-xs mt-1">Deal: {pendency.existing_deal.titulo} ({pendency.existing_deal.status})</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={() => handleAction('KEPT_SEPARATE')} disabled={resolve.isPending}>
            <Check className="h-3.5 w-3.5 mr-1" />Manter Separados
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('DISMISSED')} disabled={resolve.isPending}>
            <X className="h-3.5 w-3.5 mr-1" />Dispensar
          </Button>
          {onDealClick && pendency.new_deal_id && (
            <Button size="sm" variant="default" onClick={() => onDealClick(pendency.new_deal_id)}>
              <ArrowRight className="h-3.5 w-3.5 mr-1" />Ver Deal
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
