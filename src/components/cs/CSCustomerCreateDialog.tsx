import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContacts } from '@/hooks/useContacts';
import { useCompany } from '@/contexts/CompanyContext';
import { useCreateCSCustomer } from '@/hooks/useCSCustomers';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export function CSCustomerCreateDialog() {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactId, setContactId] = useState('');
  const [empresa, setEmpresa] = useState<string>(activeCompany !== 'ALL' ? activeCompany : 'BLUE');
  const [valorMrr, setValorMrr] = useState('');
  const [proximaRenovacao, setProximaRenovacao] = useState('');
  const [notas, setNotas] = useState('');

  const { data: contactsData } = useContacts(contactSearch, 0);
  const contacts = contactsData?.data ?? [];
  const createMutation = useCreateCSCustomer();

  const handleSubmit = async () => {
    if (!contactId) {
      toast.error('Selecione um contato');
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        contact_id: contactId,
        empresa: empresa as 'BLUE' | 'TOKENIZA',
        valor_mrr: valorMrr ? Number(valorMrr) : 0,
        proxima_renovacao: proximaRenovacao || null,
        notas: notas || null,
      });
      toast.success('Cliente CS criado com sucesso');
      setOpen(false);
      resetForm();
      if (result?.id) navigate(`/cs/clientes/${result.id}`);
    } catch {
      toast.error('Erro ao criar cliente');
    }
  };

  const resetForm = () => {
    setContactId('');
    setContactSearch('');
    setValorMrr('');
    setProximaRenovacao('');
    setNotas('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Cliente CS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Contact search */}
          <div className="space-y-1.5">
            <Label>Contato *</Label>
            <Input
              placeholder="Buscar contato por nome ou email..."
              value={contactSearch}
              onChange={(e) => { setContactSearch(e.target.value); setContactId(''); }}
            />
            {contactSearch && !contactId && contacts.length > 0 && (
              <div className="border rounded-md max-h-32 overflow-auto">
                {contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                    onClick={() => { setContactId(c.id); setContactSearch(c.nome || c.email || ''); }}
                  >
                    <span className="font-medium">{c.nome}</span>
                    {c.email && <span className="text-muted-foreground ml-2 text-xs">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Empresa */}
          <div className="space-y-1.5">
            <Label>Empresa *</Label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BLUE">Blue</SelectItem>
                <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* MRR */}
          <div className="space-y-1.5">
            <Label>MRR (R$)</Label>
            <Input type="number" min={0} placeholder="0" value={valorMrr} onChange={(e) => setValorMrr(e.target.value)} />
          </div>

          {/* Próxima renovação */}
          <div className="space-y-1.5">
            <Label>Próxima Renovação</Label>
            <Input type="date" value={proximaRenovacao} onChange={(e) => setProximaRenovacao(e.target.value)} />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea placeholder="Observações sobre o cliente..." value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!contactId || createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar Cliente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
