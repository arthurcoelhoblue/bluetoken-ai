import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Check, X } from 'lucide-react';
import type { ResolvedCustomField, CustomFieldDefinition } from '@/types/customFields';
import { useUpsertFieldValue } from '@/hooks/useCustomFields';

interface Props {
  fields: ResolvedCustomField[];
  entityType: 'CONTACT' | 'ORGANIZATION' | 'DEAL';
  entityId: string;
}

export function CustomFieldsRenderer({ fields, entityType, entityId }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const upsert = useUpsertFieldValue();

  if (!fields.length) {
    return <p className="text-sm text-muted-foreground py-4">Nenhum campo customizado configurado.</p>;
  }

  const startEdit = (field: ResolvedCustomField) => {
    setEditingId(field.definition.id);
    setEditValue(field.displayValue === '—' ? '' : field.displayValue);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveField = async (def: CustomFieldDefinition) => {
    const payload = {
      field_id: def.id,
      entity_type: entityType,
      entity_id: entityId,
    } as { field_id: string; entity_type: 'CONTACT' | 'ORGANIZATION' | 'DEAL'; entity_id: string; value_text?: string | null; value_number?: number | null; value_boolean?: boolean; value_date?: string | null };

    const vt = def.value_type;
    if (['TEXT', 'EMAIL', 'PHONE', 'URL', 'TAG'].includes(vt)) {
      payload.value_text = editValue || null;
    } else if (vt === 'TEXTAREA') {
      payload.value_text = editValue || null;
    } else if (['NUMBER', 'CURRENCY', 'PERCENT'].includes(vt)) {
      payload.value_number = editValue ? parseFloat(editValue) : null;
    } else if (vt === 'BOOLEAN') {
      payload.value_boolean = editValue === 'true';
    } else if (['DATE', 'DATETIME'].includes(vt)) {
      payload.value_date = editValue || null;
    } else if (['SELECT', 'MULTISELECT'].includes(vt)) {
      payload.value_text = editValue || null;
    }

    await upsert.mutateAsync(payload);
    cancelEdit();
  };

  // Group by grupo
  const groups = fields.reduce<Record<string, ResolvedCustomField[]>>((acc, f) => {
    const g = f.definition.grupo || 'Geral';
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([grupo, groupFields]) => (
        <div key={grupo}>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{grupo}</h4>
          <div className="space-y-2">
            {groupFields.map((f) => {
              const isEditing = editingId === f.definition.id;
              return (
                <div key={f.definition.id} className="group flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">{f.definition.label}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        {renderEditInput(f.definition, editValue, setEditValue)}
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveField(f.definition)} disabled={upsert.isPending}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm truncate">{f.displayValue}</p>
                    )}
                  </div>
                  {!isEditing && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => startEdit(f)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderEditInput(
  def: CustomFieldDefinition,
  value: string,
  onChange: (v: string) => void,
) {
  const vt = def.value_type;

  if (vt === 'TEXTAREA') {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="h-16 text-sm" />;
  }
  if (vt === 'BOOLEAN') {
    return (
      <Switch checked={value === 'true'} onCheckedChange={(c) => onChange(c ? 'true' : 'false')} />
    );
  }
  if (vt === 'SELECT' && def.options_json) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {def.options_json.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (vt === 'MULTISELECT' && def.options_json) {
    const selected = value ? value.split(',') : [];
    return (
      <div className="flex flex-wrap gap-1">
        {def.options_json.map((o) => (
          <Badge
            key={o.value}
            variant={selected.includes(o.value) ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => {
              const newVal = selected.includes(o.value)
                ? selected.filter((s) => s !== o.value)
                : [...selected, o.value];
              onChange(newVal.join(','));
            }}
          >
            {o.label}
          </Badge>
        ))}
      </div>
    );
  }
  if (['NUMBER', 'CURRENCY', 'PERCENT'].includes(vt)) {
    return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />;
  }
  if (['DATE', 'DATETIME'].includes(vt)) {
    return <Input type={vt === 'DATETIME' ? 'datetime-local' : 'date'} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />;
  }
  // TEXT, EMAIL, PHONE, URL, TAG
  return <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />;
}
