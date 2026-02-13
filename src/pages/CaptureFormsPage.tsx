import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ShareFormDialog } from '@/components/capture-forms/ShareFormDialog';
import { useCaptureForms, useCreateCaptureForm, useUpdateCaptureForm, useDeleteCaptureForm } from '@/hooks/useCaptureForms';
import { Plus, MoreHorizontal, Pencil, Eye, Share2, Trash2, Search, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import type { CaptureForm } from '@/types/captureForms';

function CaptureFormsContent() {
  const navigate = useNavigate();
  const { data: forms, isLoading } = useCaptureForms();
  const createForm = useCreateCaptureForm();
  const updateForm = useUpdateCaptureForm();
  const deleteForm = useDeleteCaptureForm();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameForm, setRenameForm] = useState<CaptureForm | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CaptureForm | null>(null);
  const [shareForm, setShareForm] = useState<CaptureForm | null>(null);

  const filtered = (forms || []).filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase())
  );

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createForm.mutateAsync({ nome: newName.trim(), slug: generateSlug(newName) });
    setCreateOpen(false);
    setNewName('');
    navigate(`/capture-forms/${result.id}/edit`);
  };

  const handleRename = async () => {
    if (!renameForm || !renameValue.trim()) return;
    await updateForm.mutateAsync({ id: renameForm.id, nome: renameValue.trim() });
    setRenameForm(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteForm.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      DRAFT: { label: 'Rascunho', variant: 'secondary' },
      PUBLISHED: { label: 'Publicado', variant: 'default' },
      ARCHIVED: { label: 'Arquivado', variant: 'outline' },
    };
    const s = map[status] || map.DRAFT;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Form de Captura</h1>
        <p className="text-muted-foreground">Gerencie seus formulários de captura de leads</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar formulário..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Form
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Nenhum formulário encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro formulário de captura de leads.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Form
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Respostas</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(form => (
                <TableRow key={form.id}>
                  <TableCell className="font-medium">{form.nome}</TableCell>
                  <TableCell>{statusBadge(form.status)}</TableCell>
                  <TableCell className="text-center">{form.submission_count ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(form.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setRenameForm(form); setRenameValue(form.nome); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/capture-forms/${form.id}/edit`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Editar conteúdo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/f/${form.slug}`, '_blank')}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShareForm(form)}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Compartilhar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(form)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Form de Captura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do formulário</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Captação Investidores" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createForm.isPending}>
              {createForm.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameForm} onOpenChange={() => setRenameForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear formulário</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Novo nome</Label>
            <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameForm(null)}>Cancelar</Button>
            <Button onClick={handleRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é irreversível. O formulário "{deleteTarget?.nome}" e todas suas submissões serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      {shareForm && (
        <ShareFormDialog
          open={!!shareForm}
          onOpenChange={() => setShareForm(null)}
          slug={shareForm.slug}
          formName={shareForm.nome}
        />
      )}
    </div>
  );
}

export default function CaptureFormsPage() {
  return (
    <AppLayout>
      <CaptureFormsContent />
    </AppLayout>
  );
}
