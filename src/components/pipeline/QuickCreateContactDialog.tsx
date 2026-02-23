import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useCreateContact } from '@/hooks/useContacts';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: { id: string; nome: string }) => void;
}

export function QuickCreateContactDialog({ open, onOpenChange, onCreated }: Props) {
  const { activeCompany } = useCompany();
  const createContact = useCreateContact();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const contact = await createContact.mutateAsync({
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        empresa: activeCompany as 'BLUE' | 'TOKENIZA',
      });
      toast.success('Contato criado!');
      onCreated({ id: contact.id, nome: contact.nome });
      onOpenChange(false);
      setNome('');
      setTelefone('');
      setEmail('');
    } catch {
      toast.error('Erro ao criar contato');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Contato Rápido</DialogTitle>
          <DialogDescription>Preencha os dados mínimos para criar o contato.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createContact.isPending}>
            {createContact.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
