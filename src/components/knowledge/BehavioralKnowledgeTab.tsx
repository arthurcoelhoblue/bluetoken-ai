import { useState } from "react";
import { BookOpen, Upload, Trash2, RefreshCw, Loader2, Power, PowerOff, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useBehavioralKnowledgeList, useUploadBehavioralBook, useToggleBehavioralBook, useDeleteBehavioralBook, useEmbedBehavioralBook } from "@/hooks/useBehavioralKnowledge";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function BehavioralKnowledgeTab() {
  const { activeCompany } = useCompany();
  const { data: books, isLoading } = useBehavioralKnowledgeList();
  const upload = useUploadBehavioralBook();
  const toggle = useToggleBehavioralBook();
  const remove = useDeleteBehavioralBook();
  const embed = useEmbedBehavioralBook();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [embedding, setEmbedding] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file || !titulo || !activeCompany) return;
    try {
      const book = await upload.mutateAsync({ file, titulo, autor, descricao, empresa: activeCompany });
      toast.success(`"${titulo}" enviado com sucesso!`);
      setIsDialogOpen(false);
      setTitulo(""); setAutor(""); setDescricao(""); setFile(null);
      // Auto-embed
      setEmbedding(book.id);
      try {
        const result = await embed.mutateAsync(book.id);
        toast.success(`Indexação concluída: ${result?.embedded || 0} chunks gerados`);
      } catch {
        toast.error("Erro na indexação automática. Tente reindexar manualmente.");
      } finally {
        setEmbedding(null);
      }
    } catch (e: any) {
      toast.error(`Erro ao enviar: ${e.message}`);
    }
  };

  const handleReindex = async (bookId: string, titulo: string) => {
    setEmbedding(bookId);
    try {
      const result = await embed.mutateAsync(bookId);
      toast.success(`"${titulo}" reindexado: ${result?.embedded || 0} chunks`);
    } catch {
      toast.error("Erro na reindexação.");
    } finally {
      setEmbedding(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Metodologia de Vendas</CardTitle>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Enviar Livro/PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Material de Metodologia</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Título *</Label>
                    <Input placeholder="Ex: SPIN Selling" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                  </div>
                  <div>
                    <Label>Autor</Label>
                    <Input placeholder="Ex: Neil Rackham" value={autor} onChange={(e) => setAutor(e.target.value)} />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea placeholder="Breve resumo do que este material ensina..." value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
                  </div>
                  <div>
                    <Label>Arquivo PDF *</Label>
                    <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleUpload} disabled={!file || !titulo || upload.isPending}>
                    {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Enviar e Indexar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Envie PDFs de livros e materiais de vendas. A Amélia absorve as técnicas para moldar <strong>como</strong> ela vende — separado da base de produtos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !books || books.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum material de metodologia enviado ainda.</p>
              <p className="text-sm mt-1">Envie PDFs de livros como SPIN Selling, Challenger Sale, etc.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {books.map((book) => (
                <div key={book.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <BookOpen className={`h-5 w-5 shrink-0 ${book.ativo ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{book.titulo}</span>
                        {book.autor && <span className="text-xs text-muted-foreground">— {book.autor}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={book.chunks_count > 0 ? "default" : "secondary"} className="text-xs">
                          {book.chunks_count} chunks
                        </Badge>
                        <span className="text-xs text-muted-foreground">{book.nome_arquivo}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(book.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      {book.descricao && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{book.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Switch
                      checked={book.ativo}
                      onCheckedChange={(checked) => toggle.mutate({ id: book.id, ativo: checked })}
                      title={book.ativo ? 'Ativo' : 'Inativo'}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReindex(book.id, book.titulo)}
                      disabled={embedding === book.id}
                      title="Reindexar"
                    >
                      {embedding === book.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir "{book.titulo}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O arquivo e todos os embeddings associados serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              remove.mutate({ id: book.id, storagePath: book.storage_path });
                              toast.success("Material removido.");
                            }}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
