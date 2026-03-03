import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useMarketingLists,
  useMarketingListMembers,
  useCreateMarketingList,
  useAddMembersToList,
  useUpdateMemberStatus,
  useDeleteMarketingList,
} from '@/hooks/useMarketingLists';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ListChecks,
  Plus,
  Users,
  Search,
  Trash2,
  UserPlus,
  CheckCircle,
  Clock,
  ArrowRightCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

function CreateListDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { activeCompany } = useCompany();
  const createList = useCreateMarketingList();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const handleCreate = () => {
    if (!nome.trim()) {
      toast.error('Informe o nome da lista.');
      return;
    }
    createList.mutate(
      { nome: nome.trim(), descricao: descricao.trim() || undefined, empresa: activeCompany },
      {
        onSuccess: () => {
          setNome('');
          setDescricao('');
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Lista de Marketing</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da lista *</Label>
            <Input placeholder="Ex: Leads IR 2026, Reativação Q1..." value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea placeholder="Objetivo da lista, critérios de seleção..." value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={createList.isPending}>
            {createList.isPending ? 'Criando...' : 'Criar Lista'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMembersDialog({ open, onOpenChange, listId }: { open: boolean; onOpenChange: (v: boolean) => void; listId: string }) {
  const { activeCompanies } = useCompany();
  const addMembers = useAddMembersToList();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ id: string; nome: string; email: string | null; telefone: string | null }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (search.length < 2) return;
    setSearching(true);
    const term = `%${search}%`;
    const { data } = await supabase
      .from('contacts')
      .select('id, nome, email, telefone')
      .in('empresa', activeCompanies)
      .or(`nome.ilike.${term},email.ilike.${term},telefone.ilike.${term}`)
      .limit(20);
    setResults(data ?? []);
    setSearching(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos um contato.');
      return;
    }
    addMembers.mutate(
      { listId, contactIds: Array.from(selected) },
      {
        onSuccess: () => {
          setSearch('');
          setResults([]);
          setSelected(new Set());
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Leads à Lista</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="border rounded-md max-h-60 overflow-auto">
              {results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2 ${selected.has(c.id) ? 'bg-primary/10' : ''}`}
                  onClick={() => toggleSelect(c.id)}
                >
                  <div className={`h-4 w-4 rounded border ${selected.has(c.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'} flex items-center justify-center`}>
                    {selected.has(c.id) && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{c.nome}</span>
                    {c.email && <span className="text-muted-foreground ml-2 text-xs">{c.email}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {selected.size > 0 && (
            <p className="text-sm text-muted-foreground">{selected.size} contato(s) selecionado(s)</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={addMembers.isPending || selected.size === 0}>
            {addMembers.isPending ? 'Adicionando...' : `Adicionar ${selected.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDENTE: { label: 'Pendente', color: 'bg-muted text-muted-foreground', icon: Clock },
  CONTATADO: { label: 'Contatado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: ArrowRightCircle },
  CONVERTIDO: { label: 'Convertido', color: 'bg-success/15 text-success', icon: CheckCircle },
};

function ListDetailSheet({ listId, open, onOpenChange }: { listId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: members = [], isLoading } = useMarketingListMembers(listId);
  const updateStatus = useUpdateMemberStatus();
  const [showAddMembers, setShowAddMembers] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-auto">
          <SheetHeader>
            <SheetTitle>Membros da Lista</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{members.length} leads</p>
              <Button size="sm" className="gap-1.5" onClick={() => setShowAddMembers(true)}>
                <UserPlus className="h-4 w-4" /> Adicionar
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum lead nesta lista ainda.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => {
                    const cfg = statusConfig[m.status] || statusConfig.PENDENTE;
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-sm">
                          {m.contacts?.nome || 'Sem nome'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.contacts?.email || m.contacts?.telefone || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={m.status}
                            onValueChange={(v) => updateStatus.mutate({ memberId: m.id, status: v })}
                          >
                            <SelectTrigger className="h-7 text-xs w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDENTE">Pendente</SelectItem>
                              <SelectItem value="CONTATADO">Contatado</SelectItem>
                              <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                              <SelectItem value="REMOVIDO">Remover</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {listId && (
        <AddMembersDialog open={showAddMembers} onOpenChange={setShowAddMembers} listId={listId} />
      )}
    </>
  );
}

function MarketingListsContent() {
  const { data: lists = [], isLoading } = useMarketingLists();
  const deleteList = useDeleteMarketingList();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-auto">
      <PageShell icon={ListChecks} title="Listas de Marketing" description="Crie e gerencie listas de leads para campanhas de marketing">
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Nova Lista
        </Button>
      </PageShell>

      <div className="px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lists.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma lista criada ainda.</p>
            <p className="text-sm mt-1">Crie uma lista para organizar leads para o marketing trabalhar.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lists.map(list => (
              <Card
                key={list.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedListId(list.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{list.nome}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteList.mutate(list.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {list.descricao && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{list.descricao}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {list.total_leads} leads
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(list.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateListDialog open={showCreate} onOpenChange={setShowCreate} />
      <ListDetailSheet
        listId={selectedListId}
        open={!!selectedListId}
        onOpenChange={(v) => !v && setSelectedListId(null)}
      />
    </div>
  );
}

export default function MarketingListsPage() {
  return (
    <AppLayout>
      <MarketingListsContent />
    </AppLayout>
  );
}
