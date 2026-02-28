import { useState } from 'react';
import { useUpdateClassification } from '@/hooks/useUpdateClassification';
import {
  ICP_LABELS,
  PERSONA_LABELS,
  TEMPERATURA_LABELS,
  PRIORIDADE_LABELS,
  TEMPERATURAS,
  PRIORIDADES,
  ICPS_TOKENIZA,
  ICPS_BLUE,
  ICPS_MPUPPE,
  ICPS_AXIA,
  PERSONAS_TOKENIZA,
  PERSONAS_BLUE,
  PERSONAS_MPUPPE,
  PERSONAS_AXIA,
} from '@/types/classification';
import type {
  LeadClassification,
  ICP,
  Temperatura,
  Prioridade,
  Persona,
} from '@/types/classification';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface EditClassificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classification: LeadClassification;
  onSuccess: () => void;
}

export function EditClassificationModal({
  open,
  onOpenChange,
  classification,
  onSuccess,
}: EditClassificationModalProps) {
  const [icp, setIcp] = useState<ICP>(classification.icp);
  const [persona, setPersona] = useState<Persona | null>(classification.persona);
  const [temperatura, setTemperatura] = useState<Temperatura>(classification.temperatura);
  const [prioridade, setPrioridade] = useState<Prioridade>(classification.prioridade);
  const [motivo, setMotivo] = useState('');

  const updateMutation = useUpdateClassification();

  const icpOptionsMap: Record<string, readonly string[]> = {
    'TOKENIZA': ICPS_TOKENIZA,
    'BLUE': ICPS_BLUE,
    'MPUPPE': ICPS_MPUPPE,
    'AXIA': ICPS_AXIA,
  };
  const personaOptionsMap: Record<string, readonly string[]> = {
    'TOKENIZA': PERSONAS_TOKENIZA,
    'BLUE': PERSONAS_BLUE,
    'MPUPPE': PERSONAS_MPUPPE,
    'AXIA': PERSONAS_AXIA,
  };
  const icpOptions = icpOptionsMap[classification.empresa] || ICPS_BLUE;
  const personaOptions = personaOptionsMap[classification.empresa] || PERSONAS_BLUE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivo.trim()) {
      toast.error('Informe o motivo da alteração');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        classificationId: classification.id,
        leadId: classification.lead_id,
        empresa: classification.empresa,
        icp,
        persona,
        temperatura,
        prioridade,
        override_motivo: motivo,
      });

      toast.success('Classificação atualizada com sucesso');
      onSuccess();
    } catch (error) {
      toast.error('Erro ao atualizar classificação');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Classificação</DialogTitle>
          <DialogDescription>
            Ajuste manual da classificação do lead. Essa alteração ficará
            registrada como "Manual".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Temperatura</Label>
            <Select
              value={temperatura}
              onValueChange={(v) => setTemperatura(v as Temperatura)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPERATURAS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TEMPERATURA_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={prioridade.toString()}
              onValueChange={(v) => setPrioridade(Number(v) as Prioridade)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p} value={p.toString()}>
                    P{p} - {PRIORIDADE_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ICP</Label>
            <Select value={icp} onValueChange={(v) => setIcp(v as ICP)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {icpOptions.map((i) => (
                  <SelectItem key={i} value={i}>
                    {ICP_LABELS[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Persona</Label>
            <Select
              value={persona || 'none'}
              onValueChange={(v) => setPersona(v === 'none' ? null : (v as Persona))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {personaOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERSONA_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Motivo da alteração <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Descreva o motivo desta alteração manual..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
