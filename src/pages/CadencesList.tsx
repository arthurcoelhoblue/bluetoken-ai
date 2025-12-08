// ========================================
// PATCH 4.1 - Lista de Cadências
// ========================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCadences } from '@/hooks/useCadences';
import {
  EMPRESA_LABELS,
  CANAL_LABELS,
  type CadencesFilters,
  type EmpresaTipo,
} from '@/types/cadence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bot,
  Eye,
  Filter,
  GitBranch,
  Search,
  X,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function CadencesListContent() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [filters, setFilters] = useState<CadencesFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: cadences, isLoading, error } = useCadences(filters);

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, searchTerm: searchInput }));
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchInput('');
  };

  const hasActiveFilters =
    filters.empresa !== undefined ||
    filters.ativo !== undefined ||
    filters.searchTerm;

  const isAdmin = roles.includes('ADMIN');

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Cadências</h1>
            <p className="text-xs text-muted-foreground">
              Fluxos de automação
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button onClick={() => navigate('/cadences/new')}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nova Cadência
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-primary' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                Ativos
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          {/* Search */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Buscar</Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Empresa
                </label>
                <Select
                  value={filters.empresa || 'all'}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      empresa: v === 'all' ? undefined : (v as EmpresaTipo),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                    <SelectItem value="BLUE">Blue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Status
                </label>
                <Select
                  value={
                    filters.ativo === undefined
                      ? 'all'
                      : filters.ativo
                        ? 'ativo'
                        : 'inativo'
                  }
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      ativo:
                        v === 'all'
                          ? undefined
                          : v === 'ativo'
                            ? true
                            : false,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar filtros
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Cadências Configuradas
              {cadences && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({cadences.length} encontradas)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Bot className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Erro ao carregar cadências. Tente novamente.
            </div>
          ) : !cadences?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma cadência encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Leads Ativos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cadences.map((cadence) => (
                    <TableRow
                      key={cadence.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/cadences/${cadence.id}`)}
                    >
                      <TableCell className="font-medium">
                        {cadence.nome}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {cadence.codigo}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            cadence.empresa === 'TOKENIZA'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {EMPRESA_LABELS[cadence.empresa]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {CANAL_LABELS[cadence.canal_principal]}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            cadence.ativo
                              ? 'bg-success text-success-foreground'
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {cadence.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {cadence.runs_ativas > 0 ? (
                          <Badge variant="outline">
                            {cadence.runs_ativas}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/cadences/${cadence.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CadencesList() {
  return (
    <AppLayout>
      <CadencesListContent />
    </AppLayout>
  );
}
