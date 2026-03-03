import { useState, useMemo } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  useDealProducts,
  useCatalogProducts,
  useAddDealProduct,
  useRemoveDealProduct,
} from '@/hooks/useDealProducts';
import type { CatalogProduct } from '@/hooks/useDealProducts';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface DealProductsTabProps {
  dealId: string;
  empresa: string | null;
}

export function DealProductsTab({ dealId, empresa }: DealProductsTabProps) {
  const { data: products = [], isLoading } = useDealProducts(dealId);
  const { data: catalog = [] } = useCatalogProducts(empresa);
  const addProduct = useAddDealProduct();
  const removeProduct = useRemoveDealProduct();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<string>('custom');
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [precoUnitario, setPrecoUnitario] = useState(0);
  const [descontoTipo, setDescontoTipo] = useState<'PERCENTUAL' | 'VALOR'>('PERCENTUAL');
  const [descontoValor, setDescontoValor] = useState(0);

  const total = useMemo(() => products.reduce((acc, p) => acc + (p.subtotal ?? 0), 0), [products]);

  const previewSubtotal = useMemo(() => {
    if (descontoTipo === 'PERCENTUAL') {
      return quantidade * precoUnitario * (1 - descontoValor / 100);
    }
    return quantidade * precoUnitario - descontoValor;
  }, [quantidade, precoUnitario, descontoTipo, descontoValor]);

  const handleCatalogSelect = (value: string) => {
    setSelectedCatalog(value);
    if (value !== 'custom') {
      const item = catalog.find((c: CatalogProduct) => c.id === value);
      if (item) {
        setNome(item.nome);
        setPrecoUnitario(item.preco_unitario);
      }
    } else {
      setNome('');
      setPrecoUnitario(0);
    }
  };

  const handleAdd = () => {
    if (!nome.trim()) {
      toast.error('Informe o nome do produto');
      return;
    }
    if (precoUnitario <= 0) {
      toast.error('Informe o preço unitário');
      return;
    }
    addProduct.mutate(
      {
        deal_id: dealId,
        catalog_product_id: selectedCatalog !== 'custom' ? selectedCatalog : undefined,
        nome: nome.trim(),
        quantidade,
        preco_unitario: precoUnitario,
        desconto_tipo: descontoTipo,
        desconto_valor: descontoValor,
      },
      {
        onSuccess: () => {
          toast.success('Produto adicionado');
          setDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleRemove = (id: string) => {
    removeProduct.mutate({ id, deal_id: dealId }, {
      onSuccess: () => toast.success('Produto removido'),
    });
  };

  const resetForm = () => {
    setSelectedCatalog('custom');
    setNome('');
    setQuantidade(1);
    setPrecoUnitario(0);
    setDescontoTipo('PERCENTUAL');
    setDescontoValor(0);
  };

  return (
    <div className="px-6 mt-3 space-y-4 pb-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos do Deal
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum produto adicionado. Clique em "Adicionar" para incluir produtos neste deal.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs text-center w-16">Qtd</TableHead>
                  <TableHead className="text-xs text-right w-24">Preço Un.</TableHead>
                  <TableHead className="text-xs text-right w-24">Desconto</TableHead>
                  <TableHead className="text-xs text-right w-28">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm text-center">{p.quantidade}</TableCell>
                    <TableCell className="text-sm text-right">{formatBRL(p.preco_unitario)}</TableCell>
                    <TableCell className="text-sm text-right">
                      {p.desconto_valor > 0
                        ? p.desconto_tipo === 'PERCENTUAL'
                          ? `${p.desconto_valor}%`
                          : formatBRL(p.desconto_valor)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold">{formatBRL(p.subtotal)}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleRemove(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remover produto</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-sm font-semibold text-right">
                    Total
                  </TableCell>
                  <TableCell className="text-sm font-bold text-right">
                    {formatBRL(total)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add product dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Adicionar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {catalog.length > 0 && (
              <div className="space-y-2">
                <Label>Selecionar do catálogo</Label>
                <Select value={selectedCatalog} onValueChange={handleCatalogSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Produto personalizado</SelectItem>
                    {catalog.map((c: CatalogProduct) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} — {formatBRL(c.preco_unitario)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome do produto *</Label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Plano IR Diamond"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantidade}
                  onChange={e => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço unitário (R$) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={precoUnitario}
                  onChange={e => setPrecoUnitario(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de desconto</Label>
                <Select value={descontoTipo} onValueChange={v => setDescontoTipo(v as 'PERCENTUAL' | 'VALOR')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
                    <SelectItem value="VALOR">Valor (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Desconto</Label>
                <Input
                  type="number"
                  min={0}
                  step={descontoTipo === 'PERCENTUAL' ? 1 : 0.01}
                  max={descontoTipo === 'PERCENTUAL' ? 100 : undefined}
                  value={descontoValor}
                  onChange={e => setDescontoValor(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-md bg-muted/50 p-3 text-right">
              <span className="text-xs text-muted-foreground mr-2">Subtotal:</span>
              <span className="text-lg font-bold">{formatBRL(Math.max(0, previewSubtotal))}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={addProduct.isPending}>
              Adicionar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
