import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Trash2, Package, X } from 'lucide-react';

const FREQUENCY_OPTIONS = [
  { label: 'Uma vez', value: 'uma_vez' },
  { label: 'Mensal', value: 'mensal' },
  { label: 'Trimestral', value: 'trimestral' },
  { label: 'Semestral', value: 'semestral' },
  { label: 'Anual', value: 'anual' },
];

const FREQ_LABELS: Record<string, string> = Object.fromEntries(FREQUENCY_OPTIONS.map(f => [f.value, f.label]));

interface CatalogProduct {
  id: string;
  nome: string;
  descricao: string | null;
  preco_unitario: number;
  unidade: string;
  frequencia_cobranca: string;
  ativo: boolean;
  empresa: string;
  created_at: string;
  updated_at: string;
}

interface Empresa {
  id: string;
  label: string;
  is_active: boolean;
}

const EMPTY_FORM = { nome: '', descricao: '', preco_unitario: '', unidade: 'un', frequencia_cobranca: 'uma_vez', empresa: '' };

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ProductsCatalogTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterEmpresa, setFilterEmpresa] = useState<string>('all');

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('id, label, is_active').order('label');
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['catalog_products_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('catalog_products').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as unknown as CatalogProduct[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog_products_all'] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.empresa) throw new Error('Selecione a empresa');
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        preco_unitario: parseFloat(form.preco_unitario) || 0,
        unidade: form.unidade || 'un',
        frequencia_cobranca: form.frequencia_cobranca,
        empresa: form.empresa as 'BLUE',
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
    setForm({
      nome: p.nome,
      descricao: p.descricao || '',
      preco_unitario: String(p.preco_unitario),
      unidade: p.unidade,
      frequencia_cobranca: p.frequencia_cobranca || 'uma_vez',
      empresa: p.empresa,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const filtered = filterEmpresa === 'all' ? products : products.filter(p => p.empresa === filterEmpresa);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Catálogo de Produtos</CardTitle>
        <div className="flex items-center gap-3">
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Filtrar empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {empresas.filter(e => e.is_active).map(e => (
                <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo Produto
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form */}
        {showForm && (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{editingId ? 'Editar Produto' : 'Novo Produto'}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Nome do produto *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Plano Premium" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Opcional" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço unitário (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.preco_unitario} onChange={e => setForm(f => ({ ...f, preco_unitario: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frequência de cobrança *</Label>
                <Select value={form.frequencia_cobranca} onValueChange={v => setForm(f => ({ ...f, frequencia_cobranca: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade</Label>
                <Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="un, mês, hora..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Empresa *</Label>
                <Select value={form.empresa} onValueChange={v => setForm(f => ({ ...f, empresa: v }))}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {empresas.filter(e => e.is_active).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!form.nome || !form.preco_unitario || !form.empresa || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {editingId ? 'Salvar' : 'Criar Produto'}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <div key={p.id} className={`flex items-center gap-3 rounded-lg border border-border p-3 ${!p.ativo ? 'opacity-50' : ''}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBRL(p.preco_unitario)} / {FREQ_LABELS[p.frequencia_cobranca] || p.frequencia_cobranca}
                    {' • '}
                    <span className="font-medium">{empresas.find(e => e.id === p.empresa)?.label || p.empresa}</span>
                  </div>
                </div>
                <Switch checked={p.ativo} onCheckedChange={v => toggleActive.mutate({ id: p.id, ativo: v })} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
