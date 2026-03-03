import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DealActivityType } from '@/types/deal';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (tipo: DealActivityType, descricao: string, prazo: string) => void;
  onSkip: () => void;
}

const SCHEDULABLE_TYPES: { value: DealActivityType; label: string }[] = [
  { value: 'TAREFA', label: 'Tarefa' },
  { value: 'LIGACAO', label: 'Ligação' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'REUNIAO', label: 'Reunião' },
];

export function ScheduleActivityDialog({ open, onOpenChange, onSchedule, onSkip }: Props) {
  const [tipo, setTipo] = useState<DealActivityType>('TAREFA');
  const [descricao, setDescricao] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);

  const handleConfirm = () => {
    if (!descricao.trim() || !date) return;
    // Use date-only ISO string (start of day) to avoid timezone issues
    const prazo = format(date, 'yyyy-MM-dd') + 'T23:59:59.999Z';
    onSchedule(tipo, descricao.trim(), prazo);
    resetAndClose();
  };

  const handleSkip = () => {
    onSkip();
    resetAndClose();
  };

  const resetAndClose = () => {
    setTipo('TAREFA');
    setDescricao('');
    setDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar próximo passo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Este deal não possui atividade futura agendada. Agende um próximo passo antes de sair.
        </p>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as DealActivityType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCHEDULABLE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descreva o próximo passo..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={d => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleSkip}>Pular desta vez</Button>
          <Button onClick={handleConfirm} disabled={!descricao.trim() || !date}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
