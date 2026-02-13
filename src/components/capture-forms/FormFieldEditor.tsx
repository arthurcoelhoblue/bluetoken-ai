import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import type { CaptureFormField, CaptureFieldType } from '@/types/captureForms';

const FIELD_TYPE_LABELS: Record<CaptureFieldType, string> = {
  short_text: 'Texto curto',
  long_text: 'Texto longo',
  email: 'Email',
  phone: 'Telefone',
  single_select: 'Seleção única',
  multi_select: 'Seleção múltipla',
  number: 'Número',
};

interface FormFieldEditorProps {
  field: CaptureFormField;
  index: number;
  onChange: (updated: CaptureFormField) => void;
  onRemove: () => void;
}

export function FormFieldEditor({ field, index, onChange, onRemove }: FormFieldEditorProps) {
  const hasOptions = field.type === 'single_select' || field.type === 'multi_select';

  const updateOption = (i: number, value: string) => {
    const opts = [...(field.options || [])];
    opts[i] = value;
    onChange({ ...field, options: opts });
  };

  const addOption = () => {
    onChange({ ...field, options: [...(field.options || []), ''] });
  };

  const removeOption = (i: number) => {
    const opts = (field.options || []).filter((_, idx) => idx !== i);
    onChange({ ...field, options: opts });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 py-3 px-4">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <span className="text-sm font-medium text-muted-foreground">Pergunta {index + 1}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Pergunta</Label>
            <Input
              value={field.label}
              onChange={e => onChange({ ...field, label: e.target.value })}
              placeholder="Ex: Qual seu nome?"
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={field.type} onValueChange={v => onChange({ ...field, type: v as CaptureFieldType, options: (v === 'single_select' || v === 'multi_select') ? (field.options || ['']) : undefined })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FIELD_TYPE_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Placeholder</Label>
          <Input
            value={field.placeholder || ''}
            onChange={e => onChange({ ...field, placeholder: e.target.value })}
            placeholder="Texto de exemplo..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={field.required} onCheckedChange={v => onChange({ ...field, required: v })} />
          <Label className="mb-0">Obrigatório</Label>
        </div>

        {hasOptions && (
          <div className="space-y-2">
            <Label>Opções</Label>
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeOption(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOption}>
              <Plus className="h-3 w-3 mr-1" />
              Adicionar opção
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
