import { ArrowUp, ArrowDown, Trash2, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StepFormData, TemplateOption } from '@/hooks/useCadenceEditor';
import type { CanalTipo, EmpresaTipo } from '@/types/cadence';
import { CANAL_LABELS } from '@/types/cadence';

interface StepEditorProps {
  step: StepFormData;
  index: number;
  totalSteps: number;
  templates: TemplateOption[];
  empresa: EmpresaTipo;
  onChange: (step: StepFormData) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function StepEditor({
  step,
  index,
  totalSteps,
  templates,
  empresa,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: StepEditorProps) {
  // Filtrar templates pela empresa e canal selecionado
  const filteredTemplates = templates.filter(
    (t) => t.empresa === empresa && t.canal === step.canal
  );

  const handleCanalChange = (canal: CanalTipo) => {
    // Limpar template ao mudar canal
    onChange({ ...step, canal, template_codigo: '' });
  };

  const handleOffsetChange = (value: string) => {
    const minutos = parseInt(value) || 0;
    onChange({ ...step, offset_minutos: Math.max(0, minutos) });
  };

  return (
    <Card className="p-4 bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">
            {index + 1}
          </span>
          Step {index + 1}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            className="h-8 w-8"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="h-8 w-8"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={totalSteps === 1}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 mt-4">
        {/* Offset / Delay */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Delay (minutos após step anterior)
          </Label>
          <Input
            type="number"
            min={0}
            value={step.offset_minutos}
            onChange={(e) => handleOffsetChange(e.target.value)}
            placeholder="0 = imediato"
          />
          <p className="text-xs text-muted-foreground">
            {step.offset_minutos === 0
              ? 'Executa imediatamente'
              : step.offset_minutos < 60
              ? `Aguarda ${step.offset_minutos} minutos`
              : step.offset_minutos < 1440
              ? `Aguarda ${Math.floor(step.offset_minutos / 60)}h ${step.offset_minutos % 60}min`
              : `Aguarda ${Math.floor(step.offset_minutos / 1440)} dia(s)`}
          </p>
        </div>

        {/* Canal */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Canal
          </Label>
          <Select value={step.canal} onValueChange={handleCanalChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CANAL_LABELS) as CanalTipo[]).map((canal) => (
                <SelectItem key={canal} value={canal}>
                  {CANAL_LABELS[canal]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template */}
        <div className="grid gap-2">
          <Label>Template de Mensagem</Label>
          <Select
            value={step.template_codigo}
            onValueChange={(v) => onChange({ ...step, template_codigo: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {filteredTemplates.length === 0 ? (
                <SelectItem value="none" disabled>
                  Nenhum template disponível para {CANAL_LABELS[step.canal]}
                </SelectItem>
              ) : (
                filteredTemplates.map((t) => (
                  <SelectItem key={t.codigo} value={t.codigo}>
                    {t.nome} ({t.codigo})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Parar se responder */}
        <div className="flex items-center justify-between">
          <Label htmlFor={`parar-${index}`} className="cursor-pointer">
            Parar cadência se lead responder
          </Label>
          <Switch
            id={`parar-${index}`}
            checked={step.parar_se_responder}
            onCheckedChange={(checked) =>
              onChange({ ...step, parar_se_responder: checked })
            }
          />
        </div>
      </div>
    </Card>
  );
}
