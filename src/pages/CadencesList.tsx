// ========================================
// PATCH 4.1 - Lista de Cadências
// ========================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
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
  ChevronLeft,
  Eye,
  Filter,
  GitBranch,
  Search,
  X,
} from 'lucide-react';

function CadencesListContent() {
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
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
            <Button
              variant="outline"
              onClick={() => navigate('/cadences/runs')}
            >
              Ver Execuções
            </Button>
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
      </header>

      <main className="container mx-auto px-4 py-6">
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

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/cadences/runs')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Leads em Cadência</p>
                  <p className="text-sm text-muted-foreground">
                    Ver todas as execuções ativas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => navigate('/cadences/next-actions')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">Próximas Ações</p>
                  <p className="text-sm text-muted-foreground">
                    Agenda de mensagens automáticas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
      </main>
    </div>
  );
}

export default function CadencesList() {
  return (
    <ProtectedRoute requiredRoles={['ADMIN', 'MARKETING', 'CLOSER']}>
      <CadencesListContent />
    </ProtectedRoute>
  );
}
