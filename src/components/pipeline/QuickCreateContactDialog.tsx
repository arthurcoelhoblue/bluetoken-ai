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
import { checkContactDuplicates, type DuplicateMatch } from '@/hooks/useContactDuplicateCheck';
import { DuplicateContactAlert } from '@/components/contacts/DuplicateContactAlert';

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
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checking, setChecking] = useState(false);

  const doCreate = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    try {
      const contact = await createContact.mutateAsync({
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        empresa: activeCompany as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
      });
      toast.success('Contato criado!');
      onCreated({ id: contact.id, nome: contact.nome });
      onOpenChange(false);
      setNome('');
      setTelefone('');
      setEmail('');
      setDuplicates([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('duplicate key') || msg.includes('idx_contacts_email') || msg.includes('idx_contacts_telefone')) {
        toast.error('Já existe um contato com este email ou telefone.');
      } else {
        toast.error('Erro ao criar contato');
      }
    }
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setChecking(true);
    try {
      const matches = await checkContactDuplicates({
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        empresa: activeCompany as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
      });
      if (matches.length > 0) {
        setDuplicates(matches);
        return;
      }
    } finally {
      setChecking(false);
    }
    await doCreate();
  };

  const handleViewContact = (id: string) => {
    window.open(`/contatos?contact=${id}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setDuplicates([]); }}>
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

          {duplicates.length > 0 && (
            <DuplicateContactAlert
              duplicates={duplicates}
              onViewContact={handleViewContact}
              onForceCreate={() => { setDuplicates([]); doCreate(); }}
              isPending={createContact.isPending}
            />
          )}
        </div>
        {duplicates.length === 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createContact.isPending || checking}>
              {(createContact.isPending || checking) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Contato
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
