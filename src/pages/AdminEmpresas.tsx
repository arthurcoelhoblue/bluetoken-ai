import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Plus, Loader2, Pencil } from 'lucide-react';

interface Empresa {
  id: string;
  label: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

const COLOR_OPTIONS = [
  { value: 'bg-primary', label: 'Azul (Primary)' },
  { value: 'bg-accent', label: 'Accent' },
  { value: 'bg-orange-500', label: 'Laranja' },
  { value: 'bg-emerald-600', label: 'Verde' },
  { value: 'bg-purple-600', label: 'Roxo' },
  { value: 'bg-red-500', label: 'Vermelho' },
  { value: 'bg-cyan-600', label: 'Ciano' },
  { value: 'bg-pink-500', label: 'Rosa' },
];

export default function AdminEmpresas() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [form, setForm] = useState({ id: '', label: '', color: 'bg-primary' });
  const [provisioning, setProvisioning] = useState<string | null>(null);

  const { data: empresas, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newEmpresa: { id: string; label: string; color: string }) => {
      const normalizedId = newEmpresa.id.toUpperCase().replace(/[^A-Z0-9_]/g, '');
      if (!normalizedId) throw new Error('ID inválido');

      // 1. Insert into empresas table
      const { error } = await supabase
        .from('empresas')
        .insert({ id: normalizedId, label: newEmpresa.label, color: newEmpresa.color });
      if (error) throw error;

      // 2. Provision tenant (enum + schema)
      setProvisioning(normalizedId);
      try {
        const { error: provError } = await supabase.functions.invoke('admin-provision-tenant', {
          body: { empresa_id: normalizedId },
        });
        if (provError) {
          toast.warning('Empresa criada, mas o provisionamento do schema falhou. Tente novamente.');
          console.error('Provision error:', provError);
        }
      } finally {
        setProvisioning(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setIsCreateOpen(false);
      setForm({ id: '', label: '', color: 'bg-primary' });
      toast.success('Empresa criada com sucesso!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (update: { id: string; label: string; color: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('empresas')
        .update({ label: update.label, color: update.color, is_active: update.is_active })
        .eq('id', update.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setEditingEmpresa(null);
      toast.success('Empresa atualizada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('empresas')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['empresas'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Empresas (Tenants)</h1>
            <p className="text-sm text-muted-foreground">Gerencie as empresas do grupo</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Empresa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ID (código único, ex: NOVA_EMPRESA)</Label>
                  <Input
                    value={form.id}
                    onChange={(e) => setForm(f => ({ ...f, id: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                    placeholder="NOME_EMPRESA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome de exibição</Label>
                  <Input
                    value={form.label}
                    onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="Nome da Empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, color: opt.value }))}
                        className={`h-8 w-8 rounded-full ${opt.value} ring-2 ring-offset-2 ring-offset-background ${form.color === opt.value ? 'ring-primary' : 'ring-transparent'} transition-all`}
                        title={opt.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.id || !form.label || createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Empresa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {provisioning && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Provisionando schema para <strong>{provisioning}</strong>...</span>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-4">
            {empresas?.map((empresa) => (
              <Card key={empresa.id} className={!empresa.is_active ? 'opacity-60' : ''}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${empresa.color}`}>
                    <Building2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{empresa.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{empresa.id}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Ativa</Label>
                      <Switch
                        checked={empresa.is_active}
                        onCheckedChange={(checked) => toggleActive.mutate({ id: empresa.id, is_active: checked })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingEmpresa(empresa)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingEmpresa} onOpenChange={(open) => !open && setEditingEmpresa(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar {editingEmpresa?.label}</DialogTitle>
            </DialogHeader>
            {editingEmpresa && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ID</Label>
                  <Input value={editingEmpresa.id} disabled className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Nome de exibição</Label>
                  <Input
                    value={editingEmpresa.label}
                    onChange={(e) => setEditingEmpresa(prev => prev ? { ...prev, label: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditingEmpresa(prev => prev ? { ...prev, color: opt.value } : null)}
                        className={`h-8 w-8 rounded-full ${opt.value} ring-2 ring-offset-2 ring-offset-background ${editingEmpresa.color === opt.value ? 'ring-primary' : 'ring-transparent'} transition-all`}
                        title={opt.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => editingEmpresa && updateMutation.mutate(editingEmpresa)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
