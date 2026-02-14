import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useContactsPage, PAGE_SIZE } from '@/hooks/useContactsPage';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Filter, Plus, Search, Users, X, Linkedin,
} from 'lucide-react';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { format } from 'date-fns';
import { ContactCreateDialog } from '@/components/contacts/ContactCreateDialog';
import { ContactDetailSheet } from '@/components/contacts/ContactDetailSheet';

const TIPO_OPTIONS = ['LEAD', 'CLIENTE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO'] as const;

function ContatosContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [clienteFilter, setClienteFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Handle ?open=ID from GlobalSearch
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      setSelectedContactId(openId);
      // Clean up query param
      searchParams.delete('open');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading, error } = useContactsPage({
    search: searchTerm,
    tipoFilter,
    clienteFilter,
    page,
  });

  const contacts = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = () => {
    setPage(0);
    setSearchTerm(searchInput);
  };

  const hasActiveFilters = tipoFilter !== 'all' || clienteFilter !== 'all' || !!searchTerm;

  const handleClearFilters = () => {
    setTipoFilter('all');
    setClienteFilter('all');
    setSearchInput('');
    setSearchTerm('');
    setPage(0);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Contatos</h1>
            <p className="text-xs text-muted-foreground">Gestão unificada de pessoas e contatos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-primary' : ''}>
            <Filter className="h-4 w-4 mr-2" />Filtros
            {hasActiveFilters && <Badge variant="secondary" className="ml-2">Ativos</Badge>}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Novo Contato
          </Button>
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
                <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TIPO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Cliente?</label>
                <Select value={clienteFilter} onValueChange={(v) => { setClienteFilter(v); setPage(0); }}>
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
            <span className="text-sm font-normal text-muted-foreground ml-2">({totalCount} encontrados)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">Erro ao carregar contatos. Tente novamente.</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum contato encontrado.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Organização</TableHead>
                      <TableHead>Deals</TableHead>
                      <TableHead>Valor Aberto</TableHead>
                      <TableHead>Score MKT</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedContactId(c.id)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {c.nome}
                            {c.linkedin_url && <Linkedin className="h-3 w-3 text-muted-foreground" />}
                            {c.opt_out && <Badge variant="destructive" className="text-[10px] px-1 py-0">opt-out</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.telefone || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={c.empresa === 'TOKENIZA' ? 'default' : 'secondary'}>{c.empresa}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.org_nome_fantasia || c.org_nome || '—'}</TableCell>
                        <TableCell className="text-sm">{c.deals_abertos}/{c.deals_count}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(c.deals_valor_total)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.score_marketing ?? '—'}</TableCell>
                        <TableCell>
                          {c.is_cliente && (
                            <Badge variant="outline" className="bg-accent text-accent-foreground">Cliente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(c.created_at), 'dd/MM/yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataTablePagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ContactCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <ContactDetailSheet contactId={selectedContactId} open={!!selectedContactId} onOpenChange={(o) => !o && setSelectedContactId(null)} />
    </div>
  );
}

export default function ContatosPage() {
  return (
    <AppLayout>
      <ContatosContent />
    </AppLayout>
  );
}
