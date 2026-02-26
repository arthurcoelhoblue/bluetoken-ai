import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

export interface MetaComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

interface Props {
  components: MetaComponent[];
  onChange: (components: MetaComponent[]) => void;
}

export function MetaComponentsEditor({ components, onChange }: Props) {
  const getComponent = (type: MetaComponent['type']) =>
    components.find((c) => c.type === type);

  function updateComponent(type: MetaComponent['type'], updates: Partial<MetaComponent>) {
    const existing = components.filter((c) => c.type !== type);
    const current = getComponent(type) || { type };
    onChange([...existing, { ...current, ...updates }]);
  }

  function removeComponent(type: MetaComponent['type']) {
    onChange(components.filter((c) => c.type !== type));
  }

  const header = getComponent('HEADER');
  const body = getComponent('BODY');
  const footer = getComponent('FOOTER');
  const buttons = getComponent('BUTTONS');

  return (
    <div className="space-y-4 border rounded-md p-4 bg-muted/30">
      <Label className="text-sm font-semibold">Componentes Meta</Label>

      {/* HEADER */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Header (opcional)</Label>
          {header ? (
            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeComponent('HEADER')}>
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => updateComponent('HEADER', { format: 'TEXT', text: '' })}>
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          )}
        </div>
        {header && (
          <Input
            value={header.text || ''}
            onChange={(e) => updateComponent('HEADER', { text: e.target.value, format: 'TEXT' })}
            placeholder="Texto do header"
          />
        )}
      </div>

      {/* BODY — always present */}
      <div className="space-y-1">
        <Label className="text-xs">Body (obrigatório)</Label>
        <Textarea
          rows={3}
          value={body?.text || ''}
          onChange={(e) => updateComponent('BODY', { text: e.target.value })}
          placeholder="Texto principal do template. Use {{1}}, {{2}} para variáveis."
        />
      </div>

      {/* FOOTER */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Footer (opcional)</Label>
          {footer ? (
            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeComponent('FOOTER')}>
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => updateComponent('FOOTER', { text: '' })}>
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          )}
        </div>
        {footer && (
          <Input
            value={footer.text || ''}
            onChange={(e) => updateComponent('FOOTER', { text: e.target.value })}
            placeholder="Texto do footer"
          />
        )}
      </div>

      {/* BUTTONS — simplified */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Botões (opcional)</Label>
          {!buttons && (
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs"
              onClick={() => updateComponent('BUTTONS', { buttons: [{ type: 'QUICK_REPLY', text: '' }] })}>
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          )}
        </div>
        {buttons?.buttons?.map((btn, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={btn.text}
              onChange={(e) => {
                const newButtons = [...(buttons.buttons || [])];
                newButtons[i] = { ...newButtons[i], text: e.target.value };
                updateComponent('BUTTONS', { buttons: newButtons });
              }}
              placeholder={`Botão ${i + 1}`}
              className="flex-1"
            />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              const newButtons = (buttons.buttons || []).filter((_, idx) => idx !== i);
              if (newButtons.length === 0) removeComponent('BUTTONS');
              else updateComponent('BUTTONS', { buttons: newButtons });
            }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {buttons && (buttons.buttons?.length || 0) < 3 && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => updateComponent('BUTTONS', { buttons: [...(buttons.buttons || []), { type: 'QUICK_REPLY', text: '' }] })}>
            <Plus className="h-3 w-3 mr-1" />Mais botão
          </Button>
        )}
      </div>
    </div>
  );
}
