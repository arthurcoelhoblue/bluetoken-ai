import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateDeal } from '@/hooks/useDeals';
import { useContacts, useCreateContact } from '@/hooks/useContacts';
import { useCompany } from '@/contexts/CompanyContext';
import type { PipelineStage } from '@/types/deal';
import { toast } from 'sonner';

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: PipelineStage[];
}

export function CreateDealDialog({ open, onOpenChange, pipelineId, stages }: CreateDealDialogProps) {
  const { activeCompany } = useCompany();
  const empresa = activeCompany === 'ALL' ? 'BLUE' : activeCompany as 'BLUE' | 'TOKENIZA';

  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('');
  const [contactId, setContactId] = useState('');
  const [contactNome, setContactNome] = useState('');
  const [stageId, setStageId] = useState(stages.find(s => !s.is_won && !s.is_lost)?.id ?? '');
  const [temperatura, setTemperatura] = useState<'FRIO' | 'MORNO' | 'QUENTE'>('FRIO');

  const { data: contacts } = useContacts();
  const createDeal = useCreateDeal();
  const createContact = useCreateContact();

  const activeStages = stages.filter(s => !s.is_won && !s.is_lost);

  const handleSubmit = async () => {
    if (!titulo.trim()) { toast.error('Título é obrigatório'); return; }

    let finalContactId = contactId;

    // If no contact selected, create one with the name
    if (!finalContactId && contactNome.trim()) {
      try {
        const contact = await createContact.mutateAsync({ nome: contactNome.trim(), empresa });
        finalContactId = contact.id;
      } catch {
        toast.error('Erro ao criar contato');
        return;
      }
    }

    if (!finalContactId) { toast.error('Selecione ou crie um contato'); return; }

    try {
      await createDeal.mutateAsync({
        titulo: titulo.trim(),
        contact_id: finalContactId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        valor: parseFloat(valor) || 0,
        temperatura,
      });
      toast.success('Deal criado com sucesso');
      onOpenChange(false);
      setTitulo('');
      setValor('');
      setContactId('');
      setContactNome('');
    } catch {
      toast.error('Erro ao criar deal');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Declaração IR 2025" />
          </div>

          <div>
            <Label>Contato</Label>
            {contacts && contacts.length > 0 ? (
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contato" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={contactNome} onChange={e => setContactNome(e.target.value)} placeholder="Nome do novo contato" />
            )}
            {contacts && contacts.length > 0 && !contactId && (
              <Input className="mt-2" value={contactNome} onChange={e => setContactNome(e.target.value)} placeholder="Ou crie um novo contato..." />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Temperatura</Label>
              <Select value={temperatura} onValueChange={v => setTemperatura(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRIO">Frio</SelectItem>
                  <SelectItem value="MORNO">Morno</SelectItem>
                  <SelectItem value="QUENTE">Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Stage Inicial</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {activeStages.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={createDeal.isPending}>
            {createDeal.isPending ? 'Criando...' : 'Criar Deal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
