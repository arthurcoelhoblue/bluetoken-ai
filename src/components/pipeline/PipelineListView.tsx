import { useState, useMemo } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, Search } from 'lucide-react';
import { format } from 'date-fns';
import { BulkActionsBar } from './BulkActionsBar';
import type { DealWithRelations, PipelineStage } from '@/types/deal';

interface OwnerOption { id: string; nome: string }

interface PipelineListViewProps {
  deals: DealWithRelations[];
  stages: PipelineStage[];
  owners: OwnerOption[];
  isLoading: boolean;
  onDealClick: (dealId: string) => void;
}

type SortKey = 'titulo' | 'valor' | 'temperatura' | 'created_at' | 'stage';
type SortDir = 'asc' | 'desc';

const TEMP_ORDER: Record<string, number> = { QUENTE: 3, MORNO: 2, FRIO: 1 };

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function tempBadgeVariant(t: string) {
  if (t === 'QUENTE') return 'destructive' as const;
  if (t === 'MORNO') return 'default' as const;
  return 'secondary' as const;
}

export function PipelineListView({ deals, stages, owners, isLoading, onDealClick }: PipelineListViewProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const stageMap = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  const filtered = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter(d =>
      d.titulo.toLowerCase().includes(q) ||
      d.contacts?.nome?.toLowerCase().includes(q)
    );
  }, [deals, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'titulo': cmp = a.titulo.localeCompare(b.titulo); break;
        case 'valor': cmp = (a.valor ?? 0) - (b.valor ?? 0); break;
        case 'temperatura': cmp = (TEMP_ORDER[a.temperatura] ?? 0) - (TEMP_ORDER[b.temperatura] ?? 0); break;
        case 'created_at': cmp = a.created_at.localeCompare(b.created_at); break;
        case 'stage': {
          const sa = stageMap.get(a.stage_id)?.posicao ?? 0;
          const sb = stageMap.get(b.stage_id)?.posicao ?? 0;
          cmp = sa - sb;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, stageMap]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const allSelected = sorted.length > 0 && sorted.every(d => selectedIds.has(d.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map(d => d.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => toggleSort(sortKeyName)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou contato..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead><SortHeader label="Título" sortKeyName="titulo" /></TableHead>
              <TableHead>Contato</TableHead>
              <TableHead><SortHeader label="Estágio" sortKeyName="stage" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Valor" sortKeyName="valor" /></TableHead>
              <TableHead><SortHeader label="Temperatura" sortKeyName="temperatura" /></TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Prob.</TableHead>
              <TableHead><SortHeader label="Criado em" sortKeyName="created_at" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  Nenhum deal encontrado
                </TableCell>
              </TableRow>
            ) : (
              sorted.map(deal => {
                const stage = stageMap.get(deal.stage_id);
                return (
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer"
                    data-state={selectedIds.has(deal.id) ? 'selected' : undefined}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(deal.id)}
                        onCheckedChange={() => toggleOne(deal.id)}
                      />
                    </TableCell>
                    <TableCell
                      className="font-medium max-w-[200px] truncate"
                      onClick={() => onDealClick(deal.id)}
                    >
                      {deal.titulo}
                    </TableCell>
                    <TableCell
                      className="max-w-[150px] truncate text-muted-foreground"
                      onClick={() => onDealClick(deal.id)}
                    >
                      {deal.contacts?.nome ?? '—'}
                    </TableCell>
                    <TableCell onClick={() => onDealClick(deal.id)}>
                      {stage ? (
                        <Badge
                          variant="outline"
                          className="text-xs whitespace-nowrap"
                          style={{ borderColor: stage.cor, color: stage.cor }}
                        >
                          {stage.nome}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums" onClick={() => onDealClick(deal.id)}>
                      {formatCurrency(deal.valor ?? 0)}
                    </TableCell>
                    <TableCell onClick={() => onDealClick(deal.id)}>
                      <Badge variant={tempBadgeVariant(deal.temperatura)} className="text-xs">
                        {deal.temperatura}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-[120px] truncate text-muted-foreground"
                      onClick={() => onDealClick(deal.id)}
                    >
                      {deal.owner?.nome ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground" onClick={() => onDealClick(deal.id)}>
                      {deal.score_probabilidade ? `${deal.score_probabilidade}%` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap" onClick={() => onDealClick(deal.id)}>
                      {format(new Date(deal.created_at), 'dd/MM/yy')}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <BulkActionsBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds(new Set())}
        stages={stages}
        owners={owners}
      />
    </div>
  );
}
