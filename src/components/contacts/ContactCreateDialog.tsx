import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useCreateContactPage } from '@/hooks/useContactsPage';
import { toast } from 'sonner';
import type { ContactFormData } from '@/types/contactsPage';

const TIPO_OPTIONS = ['LEAD', 'CLIENTE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO'] as const;
const CANAL_OPTIONS = ['WhatsApp', 'Email', 'Telefone', 'Site', 'Indicação', 'Outro'] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactCreateDialog({ open, onOpenChange }: Props) {
  const { activeCompany } = useCompany();
  const { data: orgs } = useOrganizations();
  const create = useCreateContactPage();
  const [form, setForm] = useState<Partial<ContactFormData>>({});

  const handleCreate = async () => {
    if (!form.nome?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const empresa = activeCompany === 'ALL' ? 'BLUE' : activeCompany as 'BLUE' | 'TOKENIZA';
    try {
      await create.mutateAsync({ ...form, nome: form.nome.trim(), empresa } as ContactFormData);
      toast.success('Contato criado com sucesso');
      onOpenChange(false);
      setForm({});
    } catch {
      toast.error('Erro ao criar contato');
    }
  };

  const set = (key: keyof ContactFormData, value: any) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
          <DialogDescription>Preencha os dados para criar um novo contato.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Primeiro nome</Label>
              <Input value={form.primeiro_nome ?? ''} onChange={(e) => set('primeiro_nome', e.target.value)} />
            </div>
            <div>
              <Label>Sobrenome</Label>
              <Input value={form.sobrenome ?? ''} onChange={(e) => set('sobrenome', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Nome completo *</Label>
            <Input value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo ?? ''} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Canal de origem</Label>
              <Select value={form.canal_origem ?? ''} onValueChange={(v) => set('canal_origem', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CANAL_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Organização</Label>
              <Select value={form.organization_id ?? ''} onValueChange={(v) => set('organization_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {orgs?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome_fantasia || o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notas ?? ''} onChange={(e) => set('notas', e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_cliente"
              checked={form.is_cliente ?? false}
              onCheckedChange={(c) => set('is_cliente', !!c)}
            />
            <Label htmlFor="is_cliente" className="text-sm cursor-pointer">Já é cliente</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
