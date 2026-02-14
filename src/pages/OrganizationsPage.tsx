import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useOrganizationsPage } from '@/hooks/useOrganizationsPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Plus, Search } from 'lucide-react';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { OrgCreateDialog } from '@/components/organizations/OrgCreateDialog';
import { OrgDetailSheet } from '@/components/organizations/OrgDetailSheet';

function OrganizationsContent() {
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(searchParams.get('open'));

  const { data, isLoading, error } = useOrganizationsPage({ search: searchTerm, page });

  const orgs = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 25);

  const handleSearch = () => {
    setPage(0);
    setSearchTerm(searchInput);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Organizações</h1>
            <p className="text-xs text-muted-foreground">Gestão de empresas e entidades jurídicas</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Nova Organização
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social, fantasia ou CNPJ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Buscar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Organizações
            <span className="text-sm font-normal text-muted-foreground ml-2">({totalCount} encontradas)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">Erro ao carregar organizações.</div>
          ) : orgs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhuma organização encontrada.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Contatos</TableHead>
                      <TableHead>Deals</TableHead>
                      <TableHead>Valor Aberto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.map((o) => (
                      <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedOrgId(o.id)}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{o.nome_fantasia || o.nome}</p>
                            {o.nome_fantasia && <p className="text-xs text-muted-foreground">{o.nome}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{o.cnpj || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={o.empresa === 'TOKENIZA' ? 'default' : 'secondary'}>{o.empresa}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{o.setor || '—'}</TableCell>
                        <TableCell className="text-sm">{o.contacts_count}</TableCell>
                        <TableCell className="text-sm">{o.deals_count}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(o.deals_valor_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataTablePagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={25}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <OrgCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <OrgDetailSheet orgId={selectedOrgId} open={!!selectedOrgId} onOpenChange={(o) => !o && setSelectedOrgId(null)} />
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <AppLayout>
      <OrganizationsContent />
    </AppLayout>
  );
}
