import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, FileUp, Download, File } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  useProductKnowledgeDetail, 
  useCreateProductKnowledge, 
  useUpdateProductKnowledge,
  useUpsertKnowledgeSection,
  useDeleteKnowledgeSection,
  useUploadKnowledgeDocument,
  useDeleteKnowledgeDocument,
  getDocumentUrl,
} from "@/hooks/useProductKnowledge";
import { 
  KnowledgeSectionTipo, 
  SECTION_LABELS, 
  SECTION_ICONS, 
  SECTION_ORDER,
  groupSectionsByType,
  type KnowledgeSection,
  type KnowledgeDocument,
} from "@/types/knowledge";

export default function ProductKnowledgeEditor() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const isNew = productId === 'novo';

  const { data: product, isLoading } = useProductKnowledgeDetail(
    isNew ? undefined : productId
  );

  // Form state
  const [formData, setFormData] = useState({
    empresa: 'TOKENIZA',
    produto_id: '',
    produto_nome: '',
    descricao_curta: '',
    ativo: true,
  });

  const [activeTab, setActiveTab] = useState<KnowledgeSectionTipo>('GERAL');

  // Mutations
  const createProduct = useCreateProductKnowledge();
  const updateProduct = useUpdateProductKnowledge();
  const upsertSection = useUpsertKnowledgeSection();
  const deleteSection = useDeleteKnowledgeSection();
  const uploadDocument = useUploadKnowledgeDocument();
  const deleteDocument = useDeleteKnowledgeDocument();

  // Load existing data
  useEffect(() => {
    if (product) {
      setFormData({
        empresa: product.empresa,
        produto_id: product.produto_id,
        produto_nome: product.produto_nome,
        descricao_curta: product.descricao_curta || '',
        ativo: product.ativo,
      });
    }
  }, [product]);

  const handleSaveProduct = async () => {
    if (!formData.produto_id || !formData.produto_nome) {
      toast.error("Preencha o ID e nome do produto");
      return;
    }

    try {
      if (isNew) {
        const created = await createProduct.mutateAsync(formData);
        toast.success("Produto criado com sucesso");
        navigate(`/admin/produtos/${created.id}`, { replace: true });
      } else {
        await updateProduct.mutateAsync({ id: productId!, ...formData });
        toast.success("Produto atualizado");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar produto");
    }
  };

  const groupedSections = product ? groupSectionsByType(product.sections) : null;

  if (isLoading && !isNew) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/produtos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isNew ? 'Novo Produto' : formData.produto_nome || 'Editar Produto'}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? 'Configure o conhecimento do produto' : `ID: ${formData.produto_id}`}
            </p>
          </div>
          <Button onClick={handleSaveProduct} disabled={createProduct.isPending || updateProduct.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>

        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Select 
                value={formData.empresa} 
                onValueChange={(v) => setFormData(f => ({ ...f, empresa: v as 'TOKENIZA' | 'BLUE' }))}
                disabled={!isNew}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                  <SelectItem value="BLUE">Blue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="produto_id">ID do Produto</Label>
              <Input
                id="produto_id"
                placeholder="ex: oferta-solar-2024"
                value={formData.produto_id}
                onChange={(e) => setFormData(f => ({ ...f, produto_id: e.target.value }))}
                disabled={!isNew}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="produto_nome">Nome do Produto</Label>
              <Input
                id="produto_nome"
                placeholder="ex: Oferta Solar 2024"
                value={formData.produto_nome}
                onChange={(e) => setFormData(f => ({ ...f, produto_nome: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descricao_curta">Descrição Curta</Label>
              <Textarea
                id="descricao_curta"
                placeholder="Breve descrição do produto..."
                value={formData.descricao_curta}
                onChange={(e) => setFormData(f => ({ ...f, descricao_curta: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData(f => ({ ...f, ativo: checked }))}
              />
              <Label htmlFor="ativo">Produto ativo (visível para SDR)</Label>
            </div>
          </CardContent>
        </Card>

        {/* Sections - Only show after product is created */}
        {!isNew && product && (
          <Card>
            <CardHeader>
              <CardTitle>Seções de Conhecimento</CardTitle>
              <CardDescription>
                Conteúdo usado pelo SDR IA para responder perguntas sobre o produto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as KnowledgeSectionTipo)}>
                <TabsList className="grid grid-cols-3 lg:grid-cols-6 mb-4">
                  {SECTION_ORDER.map(tipo => (
                    <TabsTrigger key={tipo} value={tipo} className="text-xs">
                      {SECTION_ICONS[tipo]} {SECTION_LABELS[tipo].split(' ')[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {SECTION_ORDER.map(tipo => (
                  <TabsContent key={tipo} value={tipo}>
                    <SectionEditor
                      productId={product.id}
                      tipo={tipo}
                      sections={groupedSections?.[tipo] || []}
                      onSave={upsertSection.mutateAsync}
                      onDelete={(id) => deleteSection.mutateAsync({ id, productId: product.id })}
                      isSaving={upsertSection.isPending}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Documents - Only show after product is created */}
        {!isNew && product && (
          <Card>
            <CardHeader>
              <CardTitle>Documentos de Referência</CardTitle>
              <CardDescription>
                PDFs, planilhas e outros arquivos para consulta (não usados diretamente pelo SDR)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentManager
                productId={product.id}
                documents={product.documents}
                onUpload={uploadDocument.mutateAsync}
                onDelete={(id, path) => deleteDocument.mutateAsync({ id, storagePath: path, productId: product.id })}
                isUploading={uploadDocument.isPending}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// Section Editor Component
function SectionEditor({
  productId,
  tipo,
  sections,
  onSave,
  onDelete,
  isSaving,
}: {
  productId: string;
  tipo: KnowledgeSectionTipo;
  sections: KnowledgeSection[];
  onSave: (section: Partial<KnowledgeSection>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  isSaving: boolean;
}) {
  const [editingSection, setEditingSection] = useState<Partial<KnowledgeSection> | null>(null);

  const handleAddSection = () => {
    setEditingSection({
      product_knowledge_id: productId,
      tipo,
      titulo: '',
      conteudo: '',
      ordem: sections.length,
    });
  };

  const handleSave = async () => {
    if (!editingSection?.titulo || !editingSection?.conteudo) {
      toast.error("Preencha título e conteúdo");
      return;
    }

    try {
      await onSave(editingSection);
      setEditingSection(null);
      toast.success("Seção salva");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar seção");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast.success("Seção removida");
    } catch (error) {
      toast.error("Erro ao remover seção");
    }
  };

  return (
    <div className="space-y-4">
      {sections.map(section => (
        <div key={section.id} className="border rounded-lg p-4">
          {editingSection?.id === section.id ? (
            <div className="space-y-3">
              <Input
                placeholder="Título"
                value={editingSection.titulo || ''}
                onChange={(e) => setEditingSection(s => ({ ...s, titulo: e.target.value }))}
              />
              <Textarea
                placeholder="Conteúdo (suporta Markdown)"
                value={editingSection.conteudo || ''}
                onChange={(e) => setEditingSection(s => ({ ...s, conteudo: e.target.value }))}
                rows={6}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingSection(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium">{section.titulo}</h4>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingSection(section)}
                  >
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover seção?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground"
                          onClick={() => handleDelete(section.id)}
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {section.conteudo.length > 200 
                  ? section.conteudo.slice(0, 200) + '...' 
                  : section.conteudo}
              </p>
            </div>
          )}
        </div>
      ))}

      {editingSection && !editingSection.id && (
        <div className="border rounded-lg p-4 border-dashed">
          <div className="space-y-3">
            <Input
              placeholder="Título"
              value={editingSection.titulo || ''}
              onChange={(e) => setEditingSection(s => ({ ...s, titulo: e.target.value }))}
            />
            <Textarea
              placeholder="Conteúdo (suporta Markdown)"
              value={editingSection.conteudo || ''}
              onChange={(e) => setEditingSection(s => ({ ...s, conteudo: e.target.value }))}
              rows={6}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingSection(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {!editingSection && (
        <Button variant="outline" className="w-full" onClick={handleAddSection}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar {SECTION_LABELS[tipo]}
        </Button>
      )}
    </div>
  );
}

// Document Manager Component
function DocumentManager({
  productId,
  documents,
  onUpload,
  onDelete,
  isUploading,
}: {
  productId: string;
  documents: KnowledgeDocument[];
  onUpload: (params: { productId: string; file: File; tipoDocumento?: string; descricao?: string }) => Promise<unknown>;
  onDelete: (id: string, storagePath: string) => Promise<unknown>;
  isUploading: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        await onUpload({ productId, file });
        toast.success(`"${file.name}" enviado`);
      } catch (error: unknown) {
        toast.error(`Erro ao enviar "${file.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDownload = async (doc: KnowledgeDocument) => {
    const url = await getDocumentUrl(doc.storage_path);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error("Erro ao obter link do documento");
    }
  };

  const handleDelete = async (doc: KnowledgeDocument) => {
    try {
      await onDelete(doc.id, doc.storage_path);
      toast.success("Documento removido");
    } catch (error) {
      toast.error("Erro ao remover documento");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-2">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <Button variant="outline" asChild disabled={isUploading}>
          <label htmlFor="file-upload" className="cursor-pointer">
            {isUploading ? 'Enviando...' : 'Selecionar Arquivos'}
          </label>
        </Button>
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <File className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{doc.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover documento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O arquivo será removido permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground"
                        onClick={() => handleDelete(doc)}
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
