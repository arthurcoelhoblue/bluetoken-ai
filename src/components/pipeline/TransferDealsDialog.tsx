import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTransferDeals } from '@/hooks/deals/useDealMutations';
import type { DealWithRelations } from '@/types/deal';

interface Owner {
  id: string;
  nome: string;
}

interface TransferDealsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: DealWithRelations[];
  owners: Owner[];
}

export function TransferDealsDialog({ open, onOpenChange, deals, owners }: TransferDealsDialogProps) {
  const [fromOwnerId, setFromOwnerId] = useState('all');
  const [toOwnerId, setToOwnerId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const transfer = useTransferDeals();

  const filteredDeals = useMemo(() => {
    if (fromOwnerId === 'all') return deals;
    return deals.filter(d => d.owner_id === fromOwnerId);
  }, [deals, fromOwnerId]);

  const toggleAll = () => {
    if (selectedIds.size === filteredDeals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDeals.map(d => d.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleTransfer = () => {
    if (!toOwnerId) { toast.error('Selecione o vendedor de destino'); return; }
    if (selectedIds.size === 0) { toast.error('Selecione pelo menos um deal'); return; }
    transfer.mutate({ dealIds: Array.from(selectedIds), toOwnerId }, {
      onSuccess: () => {
        toast.success(`${selectedIds.size} deal(s) transferido(s)`);
        setSelectedIds(new Set());
        setToOwnerId('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir deals em massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtro por vendedor de origem */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Filtrar por vendedor atual</label>
            <Select value={fromOwnerId} onValueChange={v => { setFromOwnerId(v); setSelectedIds(new Set()); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {owners.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendedor de destino */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Transferir para</label>
            <Select value={toOwnerId} onValueChange={setToOwnerId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecionar vendedor destino" />
              </SelectTrigger>
              <SelectContent>
                {owners.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de deals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{filteredDeals.length} deals • {selectedIds.size} selecionado(s)</span>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={toggleAll}>
                {selectedIds.size === filteredDeals.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>
            <ScrollArea className="h-[240px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredDeals.map(d => (
                  <label key={d.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{d.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {d.contacts?.nome ?? '—'} • {d.owner?.nome ?? 'Sem vendedor'} • R$ {(d.valor ?? 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </label>
                ))}
                {filteredDeals.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum deal encontrado</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleTransfer} disabled={transfer.isPending || selectedIds.size === 0 || !toOwnerId}>
            {transfer.isPending ? 'Transferindo...' : `Transferir ${selectedIds.size} deal(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
