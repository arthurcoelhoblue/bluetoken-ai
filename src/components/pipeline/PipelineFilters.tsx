import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Bot, Filter, Thermometer, User, Tag, Kanban } from 'lucide-react';
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
    <aside className="w-60 shrink-0 flex flex-col gap-1 border-r border-border bg-muted/30 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</span>
      </div>

      {/* Pipeline */}
      <FilterGroup icon={Kanban} label="Pipeline">
        <Select value={selectedPipelineId ?? ''} onValueChange={onPipelineChange}>
          <SelectTrigger className="w-full h-8 text-xs">
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
      </FilterGroup>

      <Separator className="my-1" />

      {/* Temperatura */}
      <FilterGroup icon={Thermometer} label="Temperatura">
        <Select value={temperatura} onValueChange={onTemperaturaChange}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="QUENTE">Quente</SelectItem>
            <SelectItem value="MORNO">Morno</SelectItem>
            <SelectItem value="FRIO">Frio</SelectItem>
          </SelectContent>
        </Select>
      </FilterGroup>

      <Separator className="my-1" />

      {/* Vendedor */}
      <FilterGroup icon={User} label="Vendedor">
        <Select value={ownerId} onValueChange={onOwnerChange} disabled={ownerDisabled}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {owners.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterGroup>

      {/* Tags */}
      {availableTags.length > 0 && (
        <>
          <Separator className="my-1" />
          <FilterGroup icon={Tag} label="Tag">
            <Select value={tag} onValueChange={onTagChange}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableTags.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterGroup>
        </>
      )}

      <Separator className="my-1" />

      {/* IA Filter */}
      <Button
        variant={etiquetaIA ? 'default' : 'outline'}
        size="sm"
        className="w-full justify-start gap-2 h-8 text-xs"
        onClick={() => onEtiquetaIAChange(!etiquetaIA)}
      >
        <Bot className="h-3.5 w-3.5" />
        Atendimento IA
        {etiquetaIA && (
          <Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">on</Badge>
        )}
      </Button>

      {/* Spacer + New Deal */}
      <div className="mt-auto pt-4">
        <Button onClick={onNewDeal} size="sm" className="w-full gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Deal
        </Button>
      </div>
    </aside>
  );
}

function FilterGroup({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}
