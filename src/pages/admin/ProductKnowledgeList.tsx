import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, FileText, Edit2, Trash2, CheckCircle, XCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useProductKnowledgeList, useDeleteProductKnowledge } from "@/hooks/useProductKnowledge";
import { toast } from "sonner";

export default function ProductKnowledgeList() {
  const [empresaFilter, setEmpresaFilter] = useState<'TOKENIZA' | 'BLUE' | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const { data: products, isLoading } = useProductKnowledgeList(
    empresaFilter === 'all' ? undefined : empresaFilter
  );
  const deleteProduct = useDeleteProductKnowledge();

  const filteredProducts = products?.filter(p => 
    p.produto_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.produto_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string, nome: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success(`Produto "${nome}" removido com sucesso`);
    } catch (error) {
      toast.error("Erro ao remover produto");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Treinamento de Produtos</h1>
            <p className="text-muted-foreground">
              Gerencie o conhecimento dos produtos para o SDR IA
            </p>
          </div>
          <Button onClick={() => navigate('/admin/produtos/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select 
            value={empresaFilter} 
            onValueChange={(v) => setEmpresaFilter(v as typeof empresaFilter)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
              <SelectItem value="BLUE">Blue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Product List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'Tente outro termo de busca' : 'Comece adicionando um novo produto'}
              </p>
              {!searchTerm && (
                <Button onClick={() => navigate('/admin/produtos/novo')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts?.map(product => (
              <Card key={product.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {product.produto_nome}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        ID: {product.produto_id}
                      </p>
                    </div>
                    <Badge variant={product.empresa === 'TOKENIZA' ? 'default' : 'secondary'}>
                      {product.empresa}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {product.descricao_curta && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {product.descricao_curta}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {product.ativo ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/produtos/${product.id}`)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso irá remover permanentemente "{product.produto_nome}" e todas as suas seções e documentos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => handleDelete(product.id, product.produto_nome)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
