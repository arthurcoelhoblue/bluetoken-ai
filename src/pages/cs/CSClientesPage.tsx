import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { useCSCustomers } from '@/hooks/useCSCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { healthStatusConfig, npsConfig, type CSHealthStatus, type CSCustomerFilters } from '@/types/customerSuccess';
import { CSCustomerCreateDialog } from '@/components/cs/CSCustomerCreateDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CSClientesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<CSCustomerFilters>({ is_active: true });
  const [search, setSearch] = useState('');

  const { data, isLoading } = useCSCustomers(filters, page);
  const customers = data?.data ?? [];
  const totalPages = data ? Math.ceil(data.count / data.pageSize) : 0;

  const filtered = search
    ? customers.filter(c =>
        c.contact?.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.contact?.email?.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  return (
    <AppLayout>
    <div className="flex-1 overflow-auto">
      <PageShell icon={Users} title="Clientes CS" description="Lista de clientes no módulo de Sucesso do Cliente">
        <CSCustomerCreateDialog />
      </PageShell>

      <div className="px-6 pb-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filters.health_status || 'ALL'} onValueChange={(v) => setFilters(f => ({ ...f, health_status: v === 'ALL' ? undefined : v as CSHealthStatus }))}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Health Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="SAUDAVEL">Saudável</SelectItem>
              <SelectItem value="ATENCAO">Atenção</SelectItem>
              <SelectItem value="EM_RISCO">Em Risco</SelectItem>
              <SelectItem value="CRITICO">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>NPS</TableHead>
                  <TableHead>CSAT</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Churn Risk</TableHead>
                  <TableHead>Últ. Contato</TableHead>
                  <TableHead>Renovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/cs/clientes/${c.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.contact?.foto_url || undefined} />
                          <AvatarFallback className="text-xs">{c.contact?.nome?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{c.contact?.nome || 'Sem nome'}</p>
                          <p className="text-xs text-muted-foreground">{c.contact?.email || ''}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={healthStatusConfig[c.health_status]?.bgClass || ''}>
                        {c.health_score} — {healthStatusConfig[c.health_status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.nps_categoria ? <Badge variant="outline" className={npsConfig[c.nps_categoria]?.bgClass}>{c.ultimo_nps}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>{c.media_csat != null ? c.media_csat.toFixed(1) : '—'}</TableCell>
                    <TableCell className="font-medium">R$ {(c.valor_mrr ?? 0).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      {(c.risco_churn_pct ?? 0) > 0 ? (
                        <Badge variant="outline" className={
                          (c.risco_churn_pct ?? 0) > 70 ? 'bg-red-100 text-red-800' :
                          (c.risco_churn_pct ?? 0) > 40 ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {c.risco_churn_pct}%
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.ultimo_contato_em ? format(new Date(c.ultimo_contato_em), 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.proxima_renovacao ? format(new Date(c.proxima_renovacao), 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{data?.count} clientes no total</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
