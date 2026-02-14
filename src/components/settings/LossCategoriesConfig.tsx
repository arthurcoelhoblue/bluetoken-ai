import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Pencil, Plus, GripVertical, ShieldAlert } from 'lucide-react';
import { useLossCategories, useCreateLossCategory, useUpdateLossCategory, useDeleteLossCategory, useReorderLossCategories } from '@/hooks/useDeals';
import { toast } from '@/hooks/use-toast';

const PROTECTED_CODES = ['PRODUTO_INADEQUADO'];

function toSnakeCode(label: string) {
  return label
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function LossCategoriesConfig() {
  const { data: categories = [], isLoading } = useLossCategories();
  const createMut = useCreateLossCategory();
  const updateMut = useUpdateLossCategory();
  const deleteMut = useDeleteLossCategory();
  const reorderMut = useReorderLossCategories();

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');

  const openNew = () => {
    setEditId(null);
    setLabel('');
    setCodigo('');
    setDescricao('');
    setEditOpen(true);
  };

  const openEdit = (cat: { id: string; label: string; codigo: string; descricao: string | null }) => {
    setEditId(cat.id);
    setLabel(cat.label);
    setCodigo(cat.codigo);
    setDescricao(cat.descricao || '');
    setEditOpen(true);
  };

  const handleLabelChange = (v: string) => {
    setLabel(v);
    if (!editId) setCodigo(toSnakeCode(v));
  };

  const save = () => {
    if (!label.trim() || !codigo.trim()) {
      toast({ title: 'Preencha label e código', variant: 'destructive' });
      return;
    }
    if (editId) {
      updateMut.mutate({ id: editId, label, codigo, descricao: descricao || null }, {
        onSuccess: () => { setEditOpen(false); toast({ title: 'Categoria atualizada' }); },
      });
    } else {
      const maxPos = categories.reduce((m, c) => Math.max(m, c.posicao), 0);
      createMut.mutate({ label, codigo, descricao: descricao || undefined, posicao: maxPos + 1 }, {
        onSuccess: () => { setEditOpen(false); toast({ title: 'Categoria criada' }); },
      });
    }
  };

  const handleDelete = (cat: { id: string; codigo: string }) => {
    if (PROTECTED_CODES.includes(cat.codigo)) {
      toast({ title: 'Esta categoria não pode ser removida', description: 'É utilizada na lógica de bypass de tempo mínimo', variant: 'destructive' });
      return;
    }
    if (!confirm('Remover esta categoria de perda?')) return;
    deleteMut.mutate(cat.id);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...categories];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMut.mutate(newOrder.map((c, i) => ({ id: c.id, posicao: i + 1 })));
  };

  const moveDown = (index: number) => {
    if (index >= categories.length - 1) return;
    const newOrder = [...categories];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMut.mutate(newOrder.map((c, i) => ({ id: c.id, posicao: i + 1 })));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Motivos de Perda</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada</p>
        ) : categories.map((cat, i) => (
          <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveUp(i)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <GripVertical className="h-3 w-3" />
              </button>
              <button onClick={() => moveDown(i)} disabled={i === categories.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                <GripVertical className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{cat.label}</span>
                <Badge variant="outline" className="text-xs font-mono">{cat.codigo}</Badge>
                {PROTECTED_CODES.includes(cat.codigo) && (
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                )}
              </div>
              {cat.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{cat.descricao}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(cat)}
                disabled={PROTECTED_CODES.includes(cat.codigo)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Label</Label>
              <Input value={label} onChange={e => handleLabelChange(e.target.value)} placeholder="Ex: Preço Alto" />
            </div>
            <div>
              <Label>Código</Label>
              <Input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="PRECO_ALTO" className="font-mono" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes sobre este motivo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
