import { useState } from 'react';
import { Plus, Search, HelpCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useKnowledgeFaqList, useDeleteFaq } from '@/hooks/useKnowledgeFaq';
import { FAQ_CATEGORIAS, FAQ_STATUS_CONFIG, type FaqStatus } from '@/types/knowledge';
import { FaqFormDialog } from './FaqFormDialog';
import { toast } from 'sonner';

export function FaqListTab() {
  const [statusFilter, setStatusFilter] = useState<FaqStatus | 'all'>('all');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data: faqs, isLoading } = useKnowledgeFaqList({
    status: statusFilter,
    categoria: categoriaFilter || undefined,
    search: search || undefined,
  });
  const deleteFaq = useDeleteFaq();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar pergunta ou resposta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as FaqStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="APROVADO">Aprovado</SelectItem>
            <SelectItem value="REJEITADO">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {FAQ_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Nova FAQ
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map(i => <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-4 w-full" /></CardContent></Card>)}
        </div>
      ) : !faqs?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma FAQ encontrada</h3>
            <p className="text-muted-foreground mb-4">Comece adicionando um novo item à base de conhecimento</p>
            <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-2" />Adicionar FAQ</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map(faq => {
            const sc = FAQ_STATUS_CONFIG[faq.status];
            return (
              <Card key={faq.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{faq.pergunta}</CardTitle>
                    <Badge variant="outline" className={sc.color}>{sc.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">{faq.resposta}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {faq.categoria && <Badge variant="secondary">{faq.categoria}</Badge>}
                      {faq.tags?.slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                    {faq.status === 'RASCUNHO' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover FAQ?</AlertDialogTitle>
                            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => {
                              deleteFaq.mutate(faq.id, { onSuccess: () => toast.success('FAQ removida') });
                            }}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Por {(faq.autor as { nome: string } | null)?.nome ?? 'Desconhecido'} • {new Date(faq.created_at).toLocaleDateString('pt-BR')}
                  </p>
                  {faq.status === 'REJEITADO' && faq.motivo_rejeicao && (
                    <p className="text-xs text-destructive">Motivo: {faq.motivo_rejeicao}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FaqFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
