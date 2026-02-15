import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { CloseDealData } from '@/hooks/useDeals';
import type { UseMutationResult } from '@tanstack/react-query';

interface LossCategory {
  id: string;
  codigo: string;
  label: string;
  descricao: string | null;
  posicao: number;
}

interface DealLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  stageId: string;
  lossCategories: LossCategory[];
  closeDeal: UseMutationResult<unknown, Error, CloseDealData>;
}

export function DealLossDialog({ open, onOpenChange, dealId, stageId, lossCategories, closeDeal }: DealLossDialogProps) {
  const [lossMotivo, setLossMotivo] = useState('');
  const [lossCategoria, setLossCategoria] = useState('');

  const handleConfirmLoss = () => {
    if (!lossMotivo.trim() || !lossCategoria) {
      toast.error('Preencha todos os campos');
      return;
    }
    closeDeal.mutate({
      dealId,
      status: 'PERDIDO',
      stageId,
      motivo_perda: lossMotivo.trim(),
      categoria_perda_closer: lossCategoria,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setLossMotivo('');
        setLossCategoria('');
        toast.info('Deal marcado como perdido');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Motivo da Perda</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={lossCategoria} onValueChange={setLossCategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lossCategories.map(c => (
                  <SelectItem key={c.codigo} value={c.codigo}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea value={lossMotivo} onChange={e => setLossMotivo(e.target.value)} placeholder="Motivo da perda..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirmLoss} disabled={closeDeal.isPending}>Confirmar Perda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
