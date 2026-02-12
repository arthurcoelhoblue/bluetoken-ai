import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useContacts, useCreateContact, type CreateContactData } from '@/hooks/useContacts';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Filter, Plus, Search, Users, X, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const TIPO_OPTIONS = ['LEAD', 'CLIENTE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO'] as const;

function ContatosContent() {
  const { activeCompany } = useCompany();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [clienteFilter, setClienteFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: contacts, isLoading, error } = useContacts(searchTerm || undefined);
  const { data: orgs } = useOrganizations();
  const createContact = useCreateContact();

  // Form state
  const [form, setForm] = useState<Partial<CreateContactData>>({});

  const filtered = useMemo(() => {
    if (!contacts) return [];
    let list = contacts;
    if (tipoFilter !== 'all') {
      list = list.filter((c) => c.tipo === tipoFilter);
    }
    if (clienteFilter !== 'all') {
      list = list.filter((c) => (clienteFilter === 'sim' ? c.is_cliente : !c.is_cliente));
    }
    return list;
  }, [contacts, tipoFilter, clienteFilter]);

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const hasActiveFilters = tipoFilter !== 'all' || clienteFilter !== 'all' || !!searchTerm;

  const handleClearFilters = () => {
    setTipoFilter('all');
    setClienteFilter('all');
    setSearchInput('');
    setSearchTerm('');
  };

  const orgMap = useMemo(() => {
    const m = new Map<string, string>();
    orgs?.forEach((o) => m.set(o.id, o.nome_fantasia || o.nome));
    return m;
  }, [orgs]);

  const handleCreate = async () => {
    if (!form.nome?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const empresa = activeCompany === 'all' ? 'BLUE' : activeCompany.toUpperCase() as 'BLUE' | 'TOKENIZA';
    try {
      await createContact.mutateAsync({
        ...form,
        nome: form.nome.trim(),
        empresa,
      } as CreateContactData);
      toast.success('Contato criado com sucesso');
      setDialogOpen(false);
      setForm({});
    } catch {
      toast.error('Erro ao criar contato');
    }
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Contatos</h1>
              <p className="text-xs text-muted-foreground">
                Gestão unificada de pessoas e contatos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-primary' : ''}>
              <Filter className="h-4 w-4 mr-2" />Filtros
              {hasActiveFilters && <Badge variant="secondary" className="ml-2">Ativos</Badge>}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Novo Contato
                </Button>
              </TooltipTrigger>
              <TooltipContent>Criar novo contato</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch}>Buscar</Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo</label>
                  <Select value={tipoFilter} onValueChange={setTipoFilter}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {TIPO_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Cliente?</label>
                  <Select value={clienteFilter} onValueChange={setClienteFilter}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      <X className="h-4 w-4 mr-2" />Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Contatos
              {filtered && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filtered.length} encontrados)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                Erro ao carregar contatos. Tente novamente.
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum contato encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Organização</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.telefone || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={c.empresa === 'TOKENIZA' ? 'default' : 'secondary'}>
                            {c.empresa}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.tipo || '—'}</TableCell>
                        <TableCell>
                          {c.organization_id ? orgMap.get(c.organization_id) || '—' : '—'}
                        </TableCell>
                        <TableCell>
                          {c.is_cliente && (
                            <Badge variant="outline" className="bg-accent text-accent-foreground">
                              Cliente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(c.tags ?? []).slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(c.created_at), 'dd/MM/yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Contato</DialogTitle>
              <DialogDescription>Preencha os dados para criar um novo contato.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Primeiro nome</Label>
                  <Input value={form.primeiro_nome ?? ''} onChange={(e) => setForm((f) => ({ ...f, primeiro_nome: e.target.value }))} />
                </div>
                <div>
                  <Label>Sobrenome</Label>
                  <Input value={form.sobrenome ?? ''} onChange={(e) => setForm((f) => ({ ...f, sobrenome: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Nome completo *</Label>
                <Input value={form.nome ?? ''} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone ?? ''} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo ?? ''} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPO_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={form.cpf ?? ''} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Organização</Label>
                <Select value={form.organization_id ?? ''} onValueChange={(v) => setForm((f) => ({ ...f, organization_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma organização" /></SelectTrigger>
                  <SelectContent>
                    {orgs?.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nome_fantasia || o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createContact.isPending}>
                {createContact.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Contato
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default function ContatosPage() {
  return (
    <AppLayout>
      <ContatosContent />
    </AppLayout>
  );
}
