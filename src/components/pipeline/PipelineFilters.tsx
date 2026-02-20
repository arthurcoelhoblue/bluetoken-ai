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
    <div className="flex items-center gap-3 flex-wrap">
      {/* Pipeline select */}
      <Select value={selectedPipelineId ?? ''} onValueChange={onPipelineChange}>
        <SelectTrigger className="w-52">
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

      {/* Temperatura filter */}
      <Select value={temperatura} onValueChange={onTemperaturaChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Temperatura" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="QUENTE">Quente</SelectItem>
          <SelectItem value="MORNO">Morno</SelectItem>
          <SelectItem value="FRIO">Frio</SelectItem>
        </SelectContent>
      </Select>

      {/* Owner filter */}
      <Select value={ownerId} onValueChange={onOwnerChange} disabled={ownerDisabled}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos vendedores</SelectItem>
          {owners.map(o => (
            <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tag filter */}
      {availableTags.length > 0 && (
        <Select value={tag} onValueChange={onTagChange}>
          <SelectTrigger className="w-48">
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

      {/* Atendimento IA quick filter */}
      <Button
        variant={etiquetaIA ? 'default' : 'outline'}
        size="sm"
        className="gap-1.5"
        onClick={() => onEtiquetaIAChange(!etiquetaIA)}
        title="Filtrar deals em atendimento pela Amélia IA"
      >
        <Bot className="h-3.5 w-3.5" />
        Atendimento IA
        {etiquetaIA && (
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">ativo</Badge>
        )}
      </Button>

      <div className="ml-auto">
        <Button onClick={onNewDeal} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo Deal
        </Button>
      </div>
    </div>
  );
}
