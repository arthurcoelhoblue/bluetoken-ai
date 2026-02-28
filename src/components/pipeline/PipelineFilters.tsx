import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Bot } from 'lucide-react';
import type { PipelineWithStages } from '@/types/deal';

interface OwnerOption {
  id: string;
  nome: string;
}

interface PipelineFiltersProps {
  pipelines: PipelineWithStages[];
  selectedPipelineId: string | null;
  onPipelineChange: (id: string) => void;
  temperatura: string;
  onTemperaturaChange: (t: string) => void;
  ownerId: string;
  onOwnerChange: (id: string) => void;
  owners: OwnerOption[];
  onNewDeal: () => void;
  tag: string;
  onTagChange: (t: string) => void;
  availableTags: string[];
  ownerDisabled?: boolean;
  etiquetaIA: boolean;
  onEtiquetaIAChange: (v: boolean) => void;
}

export function PipelineFilters({
  pipelines,
  selectedPipelineId,
  onPipelineChange,
  temperatura,
  onTemperaturaChange,
  ownerId,
  onOwnerChange,
  owners,
  onNewDeal,
  tag,
  onTagChange,
  availableTags,
  ownerDisabled,
  etiquetaIA,
  onEtiquetaIAChange,
}: PipelineFiltersProps) {
  return (
    <div className="flex flex-col gap-3 bg-muted/30 rounded-lg p-3">
      {/* Linha 1: Pipeline + Novo Deal + IA centralizados */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Select value={selectedPipelineId ?? ''} onValueChange={onPipelineChange}>
          <SelectTrigger className="w-56 h-9">
            <SelectValue placeholder="Pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome} ({p.empresa})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onNewDeal} size="sm" className="h-9">
          <Plus className="h-4 w-4 mr-1" />
          Novo Deal
        </Button>

        <Button
          variant={etiquetaIA ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 h-9 text-xs"
          onClick={() => onEtiquetaIAChange(!etiquetaIA)}
        >
          <Bot className="h-3.5 w-3.5" />
          Atendimento IA
          {etiquetaIA && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">on</Badge>
          )}
        </Button>
      </div>

      {/* Linha 2: Filtros centralizados */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Select value={temperatura} onValueChange={onTemperaturaChange}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="QUENTE">Quente</SelectItem>
            <SelectItem value="MORNO">Morno</SelectItem>
            <SelectItem value="FRIO">Frio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ownerId} onValueChange={onOwnerChange} disabled={ownerDisabled}>
          <SelectTrigger className="w-44 h-9 text-xs">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos vendedores</SelectItem>
            {owners.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {availableTags.length > 0 && (
          <Select value={tag} onValueChange={onTagChange}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {availableTags.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
