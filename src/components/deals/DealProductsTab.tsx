import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Package, FileText } from 'lucide-react';
import { useDealProducts, useCatalogProducts, useAddDealProduct, useRemoveDealProduct } from '@/hooks/useDealProducts';
import { DealProposalGenerator } from './DealProposalGenerator';

interface Props {
  dealId: string;
  pipelineEmpresa: string | null;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function DealProductsTab({ dealId, pipelineEmpresa }: Props) {
  const { data: products = [], isLoading } = useDealProducts(dealId);
  const { data: catalog = [] } = useCatalogProducts(pipelineEmpresa);
  const addProduct = useAddDealProduct();
  const removeProduct = useRemoveDealProduct();

  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [desconto, setDesconto] = useState('0');

  const handleSelectCatalog = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    const item = catalog.find(c => c.id === catalogId);
    if (item) {
      setNome(item.nome);
      setPreco(String(item.preco_unitario));
    }
  };

  const handleAdd = () => {
    if (!nome.trim() || !preco) return;
    addProduct.mutate({
      deal_id: dealId,
      product_id: selectedCatalogId || undefined,
      nome: nome.trim(),
      preco_unitario: Number(preco),
      quantidade: Number(quantidade) || 1,
      desconto: Number(desconto) || 0,
    }, {
      onSuccess: () => {
        setSelectedCatalogId('');
        setNome('');
        setPreco('');
        setQuantidade('1');
        setDesconto('0');
      },
    });
  };

  const total = products.reduce((sum, p) => sum + (p.subtotal ?? 0), 0);

  return (
    <div className="px-6 mt-3 space-y-4 pb-4">
      {/* Add product form */}
      <div className="space-y-3 p-3 border border-border rounded-lg">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar produto
        </p>
        {catalog.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Catálogo</Label>
            <Select value={selectedCatalogId} onValueChange={handleSelectCatalog}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecionar do catálogo..." />
              </SelectTrigger>
              <SelectContent>
                {catalog.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {formatBRL(c.preco_unitario)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Label className="text-xs">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-8 text-xs" placeholder="Nome do produto" />
          </div>
          <div>
            <Label className="text-xs">Preço unitário *</Label>
            <Input type="number" value={preco} onChange={e => setPreco(e.target.value)} className="h-8 text-xs" min={0} step={0.01} />
          </div>
          <div>
            <Label className="text-xs">Qtd</Label>
            <Input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="h-8 text-xs" min={1} step={1} />
          </div>
          <div>
            <Label className="text-xs">Desconto %</Label>
            <Input type="number" value={desconto} onChange={e => setDesconto(e.target.value)} className="h-8 text-xs" min={0} max={100} step={1} />
          </div>
          <div className="flex items-end">
            <Button size="sm" className="w-full h-8 text-xs" onClick={handleAdd} disabled={!nome.trim() || !preco || addProduct.isPending}>
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Product list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum produto adicionado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className="flex items-center justify-between p-2 rounded-md border border-border text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.nome}</p>
                <p className="text-muted-foreground">
                  {formatBRL(p.preco_unitario)} × {p.quantidade}
                  {p.desconto > 0 && ` (-${p.desconto}%)`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold">{formatBRL(p.subtotal)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => removeProduct.mutate({ id: p.id, dealId })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 border-t border-border font-semibold text-sm">
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
