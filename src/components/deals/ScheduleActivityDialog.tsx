import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ACTIVITY_LABELS } from '@/types/dealDetail';
import type { DealActivityType } from '@/types/dealDetail';

const SCHEDULABLE_TYPES: DealActivityType[] = ['TAREFA', 'LIGACAO', 'EMAIL', 'REUNIAO'];

interface ScheduleActivityDialogProps {
  open: boolean;
  onSchedule: (tipo: DealActivityType, descricao: string, prazo: string) => void;
  onSkip: () => void;
  dealTitulo: string;
}

export function ScheduleActivityDialog({ open, onSchedule, onSkip, dealTitulo }: ScheduleActivityDialogProps) {
  const [tipo, setTipo] = useState<DealActivityType>('TAREFA');
  const [descricao, setDescricao] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);

  const handleConfirm = () => {
    if (!descricao.trim()) {
      toast.error('Descreva a próxima atividade');
      return;
    }
    if (!date) {
      toast.error('Selecione uma data para a atividade');
      return;
    }
    onSchedule(tipo, descricao.trim(), date.toISOString());
    // Reset
    setTipo('TAREFA');
    setDescricao('');
    setDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* prevent closing by clicking outside */ }}>
      <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Agende o Próximo Passo</DialogTitle>
          <DialogDescription>
            Para sair de <strong>{dealTitulo}</strong>, agende uma próxima atividade. Todo deal precisa ter um próximo passo definido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo de atividade</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as DealActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULABLE_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{ACTIVITY_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data prevista</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Descrição da atividade *</Label>
            <Textarea
              placeholder="Ex: Ligar para confirmar interesse na proposta..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onSkip}>
            Pular desta vez
          </Button>
          <Button onClick={handleConfirm}>
            Agendar e Sair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
