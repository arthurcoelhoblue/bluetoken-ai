import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSazonalidade, useUpsertMetasBatch, type SazonalidadeIndice } from '@/hooks/useMetas';
import { MESES_LABEL, type MetaProgresso } from '@/types/metas';
import { useCompany } from '@/contexts/CompanyContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ano: number;
  vendedores: MetaProgresso[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function MetaAnualDialog({ open, onOpenChange, ano, vendedores }: Props) {
  const { activeCompany } = useCompany();
  const empresa = activeCompany === 'ALL' ? 'BLUE' : activeCompany;

  const { data: indices = [] } = useSazonalidade();
  const upsertBatch = useUpsertMetasBatch();

  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [metaAnualValor, setMetaAnualValor] = useState('');
  const [metaAnualDeals, setMetaAnualDeals] = useState('');
  const [localIndices, setLocalIndices] = useState<{ mes: number; indice: number }[]>([]);

  useEffect(() => {
    if (indices.length > 0) {
      setLocalIndices(indices.map(i => ({ mes: i.mes, indice: Number(i.indice) })));
    }
  }, [indices]);

  const somaIndices = useMemo(() => localIndices.reduce((s, i) => s + i.indice, 0), [localIndices]);

  const distribuicao = useMemo(() => {
    const valor = parseFloat(metaAnualValor) || 0;
    const deals = parseInt(metaAnualDeals) || 0;
    return localIndices.map(idx => ({
      mes: idx.mes,
      indice: idx.indice,
      valor: somaIndices > 0 ? Math.round(valor * (idx.indice / somaIndices) * 100) / 100 : 0,
      deals: somaIndices > 0 ? Math.round(deals * (idx.indice / somaIndices)) : 0,
    }));
  }, [metaAnualValor, metaAnualDeals, localIndices, somaIndices]);

  const totalDistribuido = distribuicao.reduce((s, d) => s + d.valor, 0);
  const totalDeals = distribuicao.reduce((s, d) => s + d.deals, 0);

  const uniqueVendedores = useMemo(() => {
    const map = new Map<string, { user_id: string; nome: string }>();
    vendedores.forEach(v => {
      if (!map.has(v.user_id)) map.set(v.user_id, { user_id: v.user_id, nome: v.vendedor_nome });
    });
    return Array.from(map.values());
  }, [vendedores]);

  // Query vendedores with is_vendedor flag for the selector
  const { data: vendedoresAtivos = [] } = useQuery({
    queryKey: ['vendedores-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('is_active', true)
        .eq('is_vendedor', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(p => ({ user_id: p.id, nome: p.nome || p.id }));
    },
  });

  const handleApply = () => {
    const allTargets = vendedoresAtivos.length > 0 ? vendedoresAtivos : uniqueVendedores;
    const targets = selectedUser === 'ALL' ? allTargets : allTargets.filter(v => v.user_id === selectedUser);
    const metas = targets.flatMap(v =>
      distribuicao.map(d => ({
        user_id: v.user_id,
        empresa,
        ano,
        mes: d.mes,
        meta_valor: d.valor,
        meta_deals: d.deals,
      }))
    );
    upsertBatch.mutate(metas, { onSuccess: () => onOpenChange(false) });
  };

  const handleIndiceChange = (mes: number, value: string) => {
    setLocalIndices(prev => prev.map(i => i.mes === mes ? { ...i, indice: parseFloat(value) || 0 } : i));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Definir Meta Anual {ano}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Vendedor</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os vendedores</SelectItem>
                  {(vendedoresAtivos.length > 0 ? vendedoresAtivos : uniqueVendedores).map(v => (
                    <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meta Anual (R$)</Label>
              <Input type="number" value={metaAnualValor} onChange={e => setMetaAnualValor(e.target.value)} placeholder="120000" />
            </div>
            <div>
              <Label>Meta Anual (Deals)</Label>
              <Input type="number" value={metaAnualDeals} onChange={e => setMetaAnualDeals(e.target.value)} placeholder="60" />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="w-24">Índice</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distribuicao.map(d => (
                  <TableRow key={d.mes}>
                    <TableCell className="font-medium">{MESES_LABEL[d.mes]}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.indice}
                        onChange={e => handleIndiceChange(d.mes, e.target.value)}
                        className="h-8 w-20 text-sm font-mono"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(d.valor)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{d.deals}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="font-mono text-sm">{somaIndices.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(totalDistribuido)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{totalDeals}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Fórmula: meta_mês = (meta_anual × índice) ÷ soma_índices. Os índices vêm pré-preenchidos com a sazonalidade da empresa e podem ser ajustados acima.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleApply} disabled={upsertBatch.isPending || !metaAnualValor}>
            {upsertBatch.isPending ? 'Aplicando...' : `Aplicar para ${selectedUser === 'ALL' ? 'todos' : '1 vendedor'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
