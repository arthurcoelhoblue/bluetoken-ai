import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { FilterCondition } from '@/types/filterCondition';
import type { PipelineStage } from '@/types/deal';
import { FILTER_FIELDS, OPERATORS_BY_FIELD } from '@/types/filterCondition';

interface OwnerOption { id: string; nome: string }

interface FilterConditionRowProps {
  condition: FilterCondition;
  onChange: (updated: FilterCondition) => void;
  onRemove: () => void;
  owners: OwnerOption[];
  stages: PipelineStage[];
}

export function FilterConditionRow({ condition, onChange, onRemove, owners, stages }: FilterConditionRowProps) {
  const operators = OPERATORS_BY_FIELD[condition.field] ?? [{ value: 'eq', label: 'é igual a' }];

  const handleFieldChange = (field: string) => {
    const newOps = OPERATORS_BY_FIELD[field] ?? [{ value: 'eq', label: 'é igual a' }];
    onChange({ ...condition, field, operator: newOps[0].value, value: '' });
  };

  const renderValueInput = () => {
    const { field } = condition;

    if (field === 'temperatura') {
      return (
        <Select value={String(condition.value)} onValueChange={v => onChange({ ...condition, value: v })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="QUENTE">Quente</SelectItem>
            <SelectItem value="MORNO">Morno</SelectItem>
            <SelectItem value="FRIO">Frio</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (field === 'owner_id') {
      return (
        <Select value={String(condition.value)} onValueChange={v => onChange({ ...condition, value: v })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            {owners.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    if (field === 'stage_id') {
      return (
        <Select value={String(condition.value)} onValueChange={v => onChange({ ...condition, value: v })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    if (field === 'created_at' || field === 'updated_at') {
      return (
        <Input
          type="date"
          className="w-40 h-8 text-xs"
          value={String(condition.value)}
          onChange={e => onChange({ ...condition, value: e.target.value })}
        />
      );
    }

    if (field === 'valor' || field === 'score_probabilidade') {
      return (
        <Input
          type="number"
          className="w-32 h-8 text-xs"
          placeholder="Valor"
          value={String(condition.value)}
          onChange={e => onChange({ ...condition, value: e.target.value })}
        />
      );
    }

    return (
      <Input
        className="w-40 h-8 text-xs"
        placeholder="Valor"
        value={String(condition.value)}
        onChange={e => onChange({ ...condition, value: e.target.value })}
      />
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={condition.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {FILTER_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={condition.operator} onValueChange={op => onChange({ ...condition, operator: op })}>
        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {operators.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {renderValueInput()}

      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
