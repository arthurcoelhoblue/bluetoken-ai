import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Bot, Kanban, List, SlidersHorizontal, ChevronDown, ArrowRightLeft, Sparkles, GripVertical } from 'lucide-react';
import { AdvancedFilters } from './AdvancedFilters';
import type { PipelineWithStages, PipelineStage } from '@/types/deal';
import type { AdvancedFilterState } from '@/types/filterCondition';

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
  viewMode: 'kanban' | 'list';
  onViewModeChange: (m: 'kanban' | 'list') => void;
  // Advanced filters
  stages: PipelineStage[];
  advancedFilters: AdvancedFilterState;
  onAdvancedFiltersApply: (state: AdvancedFilterState) => void;
  onAdvancedFiltersClear: () => void;
  // Kanban actions
  iaSort: boolean;
  onIaSortToggle: () => void;
  onTransferClick?: () => void;
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
  viewMode,
  onViewModeChange,
  stages,
  advancedFilters,
  onAdvancedFiltersApply,
  onAdvancedFiltersClear,
}: PipelineFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeConditionsCount = advancedFilters.conditions.length;
  const hasAdvancedActive = activeConditionsCount > 0;

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-4 py-2.5 shadow-sm">
        {/* Left: View toggle + Pipeline selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border/80 rounded-lg overflow-hidden">
            <button
              className={`p-2 transition-colors ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
              onClick={() => onViewModeChange('kanban')}
              title="Kanban"
            >
              <Kanban className="h-4 w-4" />
            </button>
            <button
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
              onClick={() => onViewModeChange('list')}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Select value={selectedPipelineId ?? ''} onValueChange={onPipelineChange}>
            <SelectTrigger className="w-52 h-9">
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
        </div>

        {/* Center: Actions */}
        <div className="flex items-center gap-2">
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

        {/* Right: Filters */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">Filtros</span>

          <Select value={temperatura} onValueChange={onTemperaturaChange} disabled={hasAdvancedActive}>
            <SelectTrigger className="w-28 h-8 text-xs border-border/50 bg-background/80">
              <SelectValue placeholder="Temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="QUENTE">Quente</SelectItem>
              <SelectItem value="MORNO">Morno</SelectItem>
              <SelectItem value="FRIO">Frio</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ownerId} onValueChange={onOwnerChange} disabled={ownerDisabled || hasAdvancedActive}>
            <SelectTrigger className="w-40 h-8 text-xs border-border/50 bg-background/80">
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
            <Select value={tag} onValueChange={onTagChange} disabled={hasAdvancedActive}>
              <SelectTrigger className="w-36 h-8 text-xs border-border/50 bg-background/80">
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

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant={hasAdvancedActive ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 h-8 text-xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Avançados
                {hasAdvancedActive && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{activeConditionsCount}</Badge>
                )}
                <ChevronDown className={`h-3 w-3 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {/* Advanced filters panel (collapsible below the bar) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent className="pt-3">
          <AdvancedFilters
            pipelineId={selectedPipelineId}
            stages={stages}
            owners={owners}
            filterState={advancedFilters}
            onApply={(state) => {
              onAdvancedFiltersApply(state);
            }}
            onClear={onAdvancedFiltersClear}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
