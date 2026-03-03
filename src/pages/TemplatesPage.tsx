import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, FileText, MessageSquare, Mail, RefreshCw, Send, Copy } from 'lucide-react';
import {
  useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
  useSyncMetaTemplates, useSubmitTemplateToMeta,
  TEMPLATE_PAGE_SIZE,
  type MessageTemplate, type TemplateInsert, type TemplateUpdate, type MetaStatus,
} from '@/hooks/useTemplates';
import { useCompany } from '@/contexts/CompanyContext';
import { TemplateFormDialog } from '@/components/templates/TemplateFormDialog';
import { ConnectionPicker } from '@/components/conversas/ConnectionPicker';
import { useWhatsAppConnections } from '@/components/conversas/ConnectionPicker';
import { MetaStatusBadge } from '@/components/templates/MetaStatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function TemplatesPage() {
  const [canalFilter, setCanalFilter] = useState<'WHATSAPP' | 'EMAIL' | null>(null);
  const [ativoFilter, setAtivoFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [metaStatusFilter, setMetaStatusFilter] = useState<MetaStatus | null>(null);
  const [connectionFilter, setConnectionFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Clone-to-another-number state
  const [cloneTemplate, setCloneTemplate] = useState<MessageTemplate | null>(null);
  const [cloneConnectionId, setCloneConnectionId] = useState<string | null>(null);

  const { activeCompanies, activeCompany } = useCompany();
  const { data, isLoading } = useTemplates(canalFilter, page, metaStatusFilter, connectionFilter);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const syncMutation = useSyncMetaTemplates();
  const submitMetaMutation = useSubmitTemplateToMeta();

  // Fetch connections for the primary active company to resolve labels in the table
  const { data: connections = [] } = useWhatsAppConnections(activeCompany);

  const connectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of connections) {
      map.set(c.id, c.label || c.display_phone || c.verified_name || c.id.slice(0, 8));
    }
    return map;
  }, [connections]);

  const templates = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const filtered = templates.filter((t) => {
    if (ativoFilter === 'active' && !t.ativo) return false;
    if (ativoFilter === 'inactive' && t.ativo) return false;
    return true;
  });

  function handleSave(data: TemplateInsert | TemplateUpdate) {
    if ('id' in data && data.id) {
      updateMutation.mutate(data as TemplateUpdate, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMutation.mutate(data as TemplateInsert, { onSuccess: () => setDialogOpen(false) });
    }
  }

  function openEdit(t: MessageTemplate) {
    setEditingTemplate(t);
    setDialogOpen(true);
  }

  function openNew() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function handleSync() {
    if (activeCompanies.length > 0) {
      syncMutation.mutate({ empresa: activeCompany, connectionId: connectionFilter || undefined });
    }
  }

  function handleSubmitToMeta(t: MessageTemplate) {
    if (!t.meta_category) return;
    const components = (t.meta_components as Array<{ type: string }>) || [{ type: 'BODY', text: t.conteudo }];
    submitMetaMutation.mutate({
      empresa: t.empresa,
      localTemplateId: t.id,
      name: t.codigo,
      category: t.meta_category,
      language: t.meta_language || 'pt_BR',
      components,
      connectionId: t.connection_id || undefined,
    });
  }

  function handleClone() {
    if (!cloneTemplate || !cloneConnectionId) return;
    const { id, created_at, updated_at, meta_template_id, meta_status, meta_rejected_reason, connection_id, codigo, ...rest } = cloneTemplate;
    const suffix = cloneConnectionId.replace(/-/g, '').slice(0, 4);
    const newCodigo = `${codigo}_${suffix}`;
    createMutation.mutate({
      ...rest,
      codigo: newCodigo,
      connection_id: cloneConnectionId,
      meta_status: 'LOCAL',
      meta_template_id: null,
      meta_rejected_reason: null,
    } as TemplateInsert, {
      onSuccess: () => {
        setCloneTemplate(null);
        setCloneConnectionId(null);
      },
    });
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Templates</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar Meta
            </Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Template</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={canalFilter ?? 'all'} onValueChange={(v) => { setCanalFilter(v === 'all' ? null : v as 'WHATSAPP' | 'EMAIL'); setConnectionFilter(null); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ativoFilter} onValueChange={(v) => setAtivoFilter(v as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={metaStatusFilter ?? 'all'} onValueChange={(v) => { setMetaStatusFilter(v === 'all' ? null : v as MetaStatus); setPage(0); }}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status Meta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="LOCAL">Local</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="APPROVED">Aprovado</SelectItem>
              <SelectItem value="REJECTED">Rejeitado</SelectItem>
            </SelectContent>
          </Select>

          {canalFilter === 'WHATSAPP' && activeCompanies.length > 0 && (
            <ConnectionPicker
              empresa={activeCompany}
              value={connectionFilter || undefined}
              onChange={(id) => { setConnectionFilter(id); setPage(0); }}
            />
          )}

          <span className="text-sm text-muted-foreground ml-auto">{totalCount} templates</span>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !filtered.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum template encontrado.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Status Meta</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(t)}>
                        <TableCell className="font-medium">{t.nome}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{t.codigo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {t.canal === 'WHATSAPP' ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                            {t.canal}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{t.empresa}</Badge>
                        </TableCell>
                        <TableCell>
                          {t.connection_id ? (
                            <span className="text-xs text-muted-foreground">
                              {connectionMap.get(t.connection_id) || t.connection_id.slice(0, 8)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.ativo ? 'default' : 'outline'}>
                            {t.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <MetaStatusBadge status={t.meta_status} rejectedReason={t.meta_rejected_reason} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {t.canal === 'WHATSAPP' && t.meta_status === 'APPROVED' && (
                              <Button variant="ghost" size="icon" title="Duplicar para outro número"
                                onClick={() => { setCloneTemplate(t); setCloneConnectionId(null); }}>
                                <Copy className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {t.canal === 'WHATSAPP' && t.meta_status === 'LOCAL' && t.meta_category && (
                              <Button variant="ghost" size="icon" title="Submeter à Meta"
                                disabled={submitMetaMutation.isPending}
                                onClick={() => handleSubmitToMeta(t)}>
                                <Send className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-4 pb-4">
                  <DataTablePagination
                    page={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={TEMPLATE_PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <TemplateFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          template={editingTemplate}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover template?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O template será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clone to another number dialog */}
        <Dialog open={!!cloneTemplate} onOpenChange={(o) => { if (!o) { setCloneTemplate(null); setCloneConnectionId(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Duplicar para outro número</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Criar uma cópia local do template <strong>{cloneTemplate?.nome}</strong> vinculada a outro número da mesma empresa ({cloneTemplate?.empresa}).
              </p>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Selecionar número destino</Label>
                {cloneTemplate && (
                  <ConnectionPicker
                    empresa={cloneTemplate.empresa}
                    value={cloneConnectionId || undefined}
                    onChange={(id) => setCloneConnectionId(id)}
                  />
                )}
              </div>
              {cloneConnectionId === cloneTemplate?.connection_id && cloneConnectionId && (
                <p className="text-xs text-amber-600">Este é o mesmo número do template original. Selecione um número diferente.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCloneTemplate(null); setCloneConnectionId(null); }}>Cancelar</Button>
              <Button
                onClick={handleClone}
                disabled={!cloneConnectionId || cloneConnectionId === cloneTemplate?.connection_id || createMutation.isPending}
              >
                {createMutation.isPending ? 'Criando...' : 'Duplicar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
