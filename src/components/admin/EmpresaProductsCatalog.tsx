import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Trash2, Package } from 'lucide-react';

interface CatalogProduct {
  id: string;
  nome: string;
  descricao: string | null;
  preco_unitario: number;
  unidade: string;
  ativo: boolean;
  empresa: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  empresaId: string;
}

const EMPTY_FORM = { nome: '', descricao: '', preco_unitario: '', unidade: 'un' };

export function EmpresaProductsCatalog({ empresaId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: products, isLoading } = useQuery({
    queryKey: ['catalog_products', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_products')
        .select('*')
        .eq('empresa', empresaId as any)
        .order('nome');
      if (error) throw error;
      return data as CatalogProduct[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog_products', empresaId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        preco_unitario: parseFloat(form.preco_unitario) || 0,
        unidade: form.unidade || 'un',
        empresa: empresaId as any,
      };
      if (editingId) {
        const { error } = await supabase.from('catalog_products').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('catalog_products').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success(editingId ? 'Produto atualizado!' : 'Produto criado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('catalog_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Produto removido!'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('catalog_products').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };

  const startEdit = (p: CatalogProduct) => {
    setForm({ nome: p.nome, descricao: p.descricao || '', preco_unitario: String(p.preco_unitario), unidade: p.unidade });
    setEditingId(p.id);
    setShowForm(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Product list */}
      {products?.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto cadastrado para esta empresa.</p>
      )}

      {products?.map((p) => (
        <div key={p.id} className={`flex items-center gap-3 rounded-lg border p-3 ${!p.ativo ? 'opacity-50' : ''}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{p.nome}</div>
            <div className="text-xs text-muted-foreground">
              R$ {p.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {p.unidade}
            </div>
          </div>
          <Switch checked={p.ativo} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, ativo: v })} />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {/* Add/Edit form */}
      {showForm ? (
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do produto</Label>
            <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Plano Premium" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Opcional" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Preço unitário (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.preco_unitario} onChange={(e) => setForm(f => ({ ...f, preco_unitario: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade</Label>
              <Input value={form.unidade} onChange={(e) => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="un, mês, hora..." />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!form.nome || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingId ? 'Salvar' : 'Adicionar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar produto
        </Button>
      )}
    </div>
  );
}
