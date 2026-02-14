import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCompany } from '@/contexts/CompanyContext';
import { useCreateOrgPage } from '@/hooks/useOrganizationsPage';
import { toast } from 'sonner';
import type { OrganizationFormData } from '@/types/contactsPage';

const SETOR_OPTIONS = ['Tecnologia', 'Finanças', 'Saúde', 'Educação', 'Varejo', 'Indústria', 'Serviços', 'Outro'];
const PORTE_OPTIONS = ['MEI', 'ME', 'EPP', 'Médio', 'Grande'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrgCreateDialog({ open, onOpenChange }: Props) {
  const { activeCompany } = useCompany();
  const create = useCreateOrgPage();
  const [form, setForm] = useState<Partial<OrganizationFormData>>({});

  const handleCreate = async () => {
    if (!form.nome?.trim()) {
      toast.error('Razão social é obrigatória');
      return;
    }
    const empresa = activeCompany === 'ALL' ? 'BLUE' : activeCompany as 'BLUE' | 'TOKENIZA';
    try {
      await create.mutateAsync({ ...form, nome: form.nome.trim(), empresa } as OrganizationFormData);
      toast.success('Organização criada com sucesso');
      onOpenChange(false);
      setForm({});
    } catch {
      toast.error('Erro ao criar organização');
    }
  };

  const set = (key: keyof OrganizationFormData, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Organização</DialogTitle>
          <DialogDescription>Dados da empresa/organização.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label>Razão Social *</Label>
            <Input value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia ?? ''} onChange={(e) => set('nome_fantasia', e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Setor</Label>
              <Select value={form.setor ?? ''} onValueChange={(v) => set('setor', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SETOR_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Porte</Label>
              <Select value={form.porte ?? ''} onValueChange={(v) => set('porte', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PORTE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.estado ?? ''} onChange={(e) => set('estado', e.target.value)} maxLength={2} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={form.cep ?? ''} onChange={(e) => set('cep', e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Organização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
