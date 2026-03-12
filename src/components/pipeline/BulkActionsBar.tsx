import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useBulkUpdateDeals } from '@/hooks/useDeals';
import { toast } from 'sonner';
import type { PipelineStage } from '@/types/deal';

interface OwnerOption { id: string; nome: string }

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  stages: PipelineStage[];
  owners: OwnerOption[];
}

export function BulkActionsBar({ selectedIds, onClearSelection, stages, owners }: BulkActionsBarProps) {
  const [stageId, setStageId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const bulkUpdate = useBulkUpdateDeals();

  if (selectedIds.size === 0) return null;

  const handleApply = async () => {
    const updates: Record<string, unknown> = {};
    if (stageId) updates.stage_id = stageId;
    if (ownerId) updates.owner_id = ownerId;
    if (temperatura) updates.temperatura = temperatura;

    if (Object.keys(updates).length === 0) {
      toast.warning('Selecione pelo menos uma alteração');
      return;
    }

    try {
      await bulkUpdate.mutateAsync({ dealIds: Array.from(selectedIds), updates });
      toast.success(`${selectedIds.size} deal(s) atualizados`);
      onClearSelection();
      setStageId('');
      setOwnerId('');
      setTemperatura('');
    } catch {
      toast.error('Erro ao atualizar deals');
    }
  };

  const activeStages = stages.filter(s => !s.is_won && !s.is_lost);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border rounded-xl shadow-lg px-5 py-3">
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
      </span>

      <div className="w-px h-6 bg-border" />

      <Select value={stageId} onValueChange={setStageId}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Mover estágio" />
        </SelectTrigger>
        <SelectContent>
          {activeStages.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={ownerId} onValueChange={setOwnerId}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          {owners.map(o => (
            <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={temperatura} onValueChange={setTemperatura}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue placeholder="Temperatura" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="FRIO">Frio</SelectItem>
          <SelectItem value="MORNO">Morno</SelectItem>
          <SelectItem value="QUENTE">Quente</SelectItem>
        </SelectContent>
      </Select>

      <Button size="sm" className="h-8" onClick={handleApply} disabled={bulkUpdate.isPending}>
        {bulkUpdate.isPending ? 'Aplicando...' : 'Aplicar'}
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClearSelection}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
