import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCSContract } from '@/hooks/useCSContracts';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface CSContractFormProps {
  customerId: string;
  empresa: string;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export function CSContractForm({ customerId, empresa }: CSContractFormProps) {
  const [open, setOpen] = useState(false);
  const [anoFiscal, setAnoFiscal] = useState(String(currentYear));
  const [plano, setPlano] = useState('');
  const [valor, setValor] = useState('');
  const [dataContratacao, setDataContratacao] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [status, setStatus] = useState('ATIVO');
  const [notas, setNotas] = useState('');
  const createMutation = useCreateCSContract();

  const handleSubmit = async () => {
    if (!plano) { toast.error('Informe o plano'); return; }
    try {
      await createMutation.mutateAsync({
        customer_id: customerId,
        empresa,
        ano_fiscal: Number(anoFiscal),
        plano,
        valor: valor ? Number(valor) : 0,
        data_contratacao: dataContratacao || null,
        data_vencimento: dataVencimento || null,
        status,
        notas: notas || null,
      });
      toast.success('Contrato adicionado');
      setOpen(false);
      resetForm();
    } catch (e: any) {
      if (e?.message?.includes('duplicate key') || e?.message?.includes('unique')) {
        toast.error('Já existe um contrato para este ano fiscal');
      } else {
        toast.error('Erro ao criar contrato');
      }
    }
  };

  const resetForm = () => {
    setPlano(''); setValor(''); setDataContratacao(''); setDataVencimento(''); setNotas('');
    setStatus('ATIVO'); setAnoFiscal(String(currentYear));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo Contrato</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ano Fiscal *</Label>
              <Select value={anoFiscal} onValueChange={setAnoFiscal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plano *</Label>
              <Select value={plano} onValueChange={setPlano}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diamond">Diamond</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" min={0} value={valor} onChange={e => setValor(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="RENOVADO">Renovado</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data Contratação</Label>
              <Input type="date" value={dataContratacao} onChange={e => setDataContratacao(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data Vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Observações..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!plano || createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Criar Contrato'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
