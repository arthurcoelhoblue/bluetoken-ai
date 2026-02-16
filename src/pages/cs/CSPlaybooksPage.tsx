import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCSPlaybooks } from '@/hooks/useCSPlaybooks';
import { useCompany } from '@/contexts/CompanyContext';
import { Plus, BookOpen, Zap, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const triggerTypes = [
  { value: 'HEALTH_DEGRADED', label: 'Health Degradou', desc: 'Quando status de saúde piora' },
  { value: 'RENEWAL_NEAR', label: 'Renovação Próxima', desc: 'X dias antes da renovação' },
  { value: 'NPS_DETRACTOR', label: 'NPS Detrator', desc: 'Quando NPS ≤ 6' },
  { value: 'INCIDENT_CRITICAL', label: 'Incidência Crítica', desc: 'Nova incidência alta/crítica' },
];

export default function CSPlaybooksPage() {
  const { activeCompany } = useCompany();
  const empresa = activeCompany;
  const { data: playbooks = [], isLoading, createPlaybook, updatePlaybook, deletePlaybook } = useCSPlaybooks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: '', descricao: '', trigger_type: 'HEALTH_DEGRADED' });

  const handleCreate = async () => {
    if (!form.nome.trim()) return toast.error('Nome obrigatório');
    try {
      await createPlaybook.mutateAsync({
        empresa: empresa || 'BLUE',
        nome: form.nome,
        descricao: form.descricao || null,
        trigger_type: form.trigger_type,
        trigger_config: {},
        steps: [],
        is_active: false,
      });
      toast.success('Playbook criado');
      setDialogOpen(false);
      setForm({ nome: '', descricao: '', trigger_type: 'HEALTH_DEGRADED' });
    } catch {
      toast.error('Erro ao criar playbook');
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await updatePlaybook.mutateAsync({ id, is_active: active });
      toast.success(active ? 'Playbook ativado' : 'Playbook desativado');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlaybook.mutateAsync(id);
      toast.success('Playbook removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <AppLayout>
    <div className="flex-1 overflow-auto">
      <PageShell icon={BookOpen} title="Playbooks CS" description="Cadências automatizadas de Customer Success" />

      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo Playbook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Playbook</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome do playbook" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                <Textarea placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                <Select value={form.trigger_type} onValueChange={v => setForm(f => ({ ...f, trigger_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleCreate} disabled={createPlaybook.isPending} className="w-full">
                  Criar Playbook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : playbooks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Nenhum playbook criado ainda.</p>
              <p className="text-sm">Playbooks automatizam ações de CS baseadas em eventos.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {playbooks.map(pb => {
              const trigger = triggerTypes.find(t => t.value === pb.trigger_type);
              return (
                <Card key={pb.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">{pb.nome}</CardTitle>
                        {pb.descricao && <p className="text-sm text-muted-foreground mt-1">{pb.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={pb.is_active ? 'default' : 'secondary'}>
                        {trigger?.label || pb.trigger_type}
                      </Badge>
                      <Switch checked={pb.is_active} onCheckedChange={v => handleToggle(pb.id, v)} />
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(pb.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {trigger?.desc || 'Trigger configurado'} • {(pb.steps as unknown[])?.length || 0} passos
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
