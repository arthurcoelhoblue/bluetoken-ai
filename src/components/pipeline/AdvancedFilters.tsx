import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FilterConditionRow } from './FilterConditionRow';
import { useSavedFilters, useSaveFilter, useDeleteSavedFilter } from '@/hooks/useSavedFilters';
import { Plus, Save, Trash2, RotateCcw, Check } from 'lucide-react';
import type { FilterCondition, AdvancedFilterState, MatchMode } from '@/types/filterCondition';
import type { PipelineStage } from '@/types/deal';

interface OwnerOption { id: string; nome: string }

interface AdvancedFiltersProps {
  pipelineId: string | null;
  stages: PipelineStage[];
  owners: OwnerOption[];
  filterState: AdvancedFilterState;
  onApply: (state: AdvancedFilterState) => void;
  onClear: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY_CONDITION: () => FilterCondition = () => ({
  id: generateId(),
  field: 'valor',
  operator: 'gt',
  value: '',
});

export function AdvancedFilters({ pipelineId, stages, owners, filterState, onApply, onClear }: AdvancedFiltersProps) {
  const [local, setLocal] = useState<AdvancedFilterState>(filterState);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string>('none');

  const { data: savedFilters = [] } = useSavedFilters(pipelineId);
  const saveFilter = useSaveFilter();
  const deleteFilter = useDeleteSavedFilter();

  const addCondition = () => {
    setLocal(prev => ({ ...prev, conditions: [...prev.conditions, EMPTY_CONDITION()] }));
  };

  const updateCondition = (id: string, updated: FilterCondition) => {
    setLocal(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => (c.id === id ? updated : c)),
    }));
  };

  const removeCondition = (id: string) => {
    setLocal(prev => ({ ...prev, conditions: prev.conditions.filter(c => c.id !== id) }));
  };

  const handleApply = () => {
    const valid = local.conditions.filter(c => c.value !== '' && c.value !== undefined);
    onApply({ ...local, conditions: valid });
  };

  const handleClear = () => {
    const empty: AdvancedFilterState = { matchMode: 'all', conditions: [] };
    setLocal(empty);
    setSelectedSavedId('none');
    onClear();
  };

  const handleSave = () => {
    if (!saveName.trim() || !pipelineId) return;
    const valid = local.conditions.filter(c => c.value !== '' && c.value !== undefined);
    saveFilter.mutate(
      { pipelineId, nome: saveName.trim(), matchMode: local.matchMode, conditions: valid },
      { onSuccess: () => { setSaveName(''); setShowSaveInput(false); } },
    );
  };

  const handleLoadSaved = (id: string) => {
    setSelectedSavedId(id);
    if (id === 'none') return;
    const found = savedFilters.find(f => f.id === id);
    if (found) {
      const state: AdvancedFilterState = {
        matchMode: found.match_mode,
        conditions: (found.conditions as FilterCondition[]).map(c => ({ ...c, id: c.id || generateId() })),
      };
      setLocal(state);
      onApply(state);
    }
  };

  const handleDeleteSaved = () => {
    if (selectedSavedId === 'none') return;
    deleteFilter.mutate(selectedSavedId, {
      onSuccess: () => { setSelectedSavedId('none'); handleClear(); },
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
      {/* Match mode */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-muted-foreground">Corresponder:</span>
        <RadioGroup
          value={local.matchMode}
          onValueChange={v => setLocal(prev => ({ ...prev, matchMode: v as MatchMode }))}
          className="flex items-center gap-4"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="all" id="match-all" />
            <Label htmlFor="match-all" className="text-xs cursor-pointer">Todas as condições</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="any" id="match-any" />
            <Label htmlFor="match-any" className="text-xs cursor-pointer">Qualquer condição</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        {local.conditions.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground w-6 text-center uppercase">
                {local.matchMode === 'all' ? 'E' : 'OU'}
              </span>
            )}
            {i === 0 && <span className="w-6" />}
            <FilterConditionRow
              condition={c}
              onChange={updated => updateCondition(c.id, updated)}
              onRemove={() => removeCondition(c.id)}
              owners={owners}
              stages={stages}
            />
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={addCondition}>
        <Plus className="h-3.5 w-3.5" />
        Adicionar condição
      </Button>

      {/* Saved filters */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/40 flex-wrap">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Filtros salvos</span>
        <Select value={selectedSavedId} onValueChange={handleLoadSaved}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Selecionar filtro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {savedFilters.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        {showSaveInput ? (
          <div className="flex items-center gap-1.5">
            <Input
              className="w-36 h-8 text-xs"
              placeholder="Nome do filtro"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave} disabled={!saveName.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowSaveInput(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => setShowSaveInput(true)}>
            <Save className="h-3.5 w-3.5" />
            Salvar
          </Button>
        )}

        {selectedSavedId !== 'none' && (
          <Button variant="outline" size="sm" className="gap-1 text-xs h-8 text-destructive hover:text-destructive" onClick={handleDeleteSaved}>
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={handleClear}>
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </Button>
        <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleApply}>
          <Check className="h-3.5 w-3.5" />
          Aplicar filtro
        </Button>
      </div>
    </div>
  );
}

// Need to import X for the cancel button in save
import { X } from 'lucide-react';
