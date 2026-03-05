import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Copy, Check, Trash2, Code, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCompany } from "@/contexts/CompanyContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

const AMELIA_FIELDS = [
  { key: "nome", label: "Nome", required: true },
  { key: "email", label: "Email", required: true },
  { key: "telefone", label: "Telefone", required: false },
];

const TRACKING_FIELDS = [
  { key: "utm_source", label: "UTM Source" },
  { key: "utm_medium", label: "UTM Medium" },
  { key: "utm_campaign", label: "UTM Campaign" },
  { key: "utm_content", label: "UTM Content" },
  { key: "utm_term", label: "UTM Term" },
  { key: "page_url", label: "Page URL" },
  { key: "referrer", label: "Referrer" },
  { key: "gclid", label: "Google Click ID (gclid)" },
  { key: "fbclid", label: "Facebook Click ID (fbclid)" },
];

interface FormMapping {
  id: string;
  form_id: string;
  empresa: string;
  pipeline_id: string | null;
  stage_id: string | null;
  field_map: Record<string, string>;
  tags_auto: string[];
  token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ExtraField {
  ameliaKey: string;
  elementorId: string;
}

const MAIN_KEYS = ["nome", "email", "telefone"];
const TRACKING_KEYS = TRACKING_FIELDS.map(f => f.key);

function splitFieldMap(fieldMap: Record<string, string>) {
  const main: Record<string, string> = {};
  const extras: ExtraField[] = [];
  const tracking: Record<string, string> = {};

  for (const [key, val] of Object.entries(fieldMap)) {
    if (MAIN_KEYS.includes(key)) {
      main[key] = val;
    } else if (TRACKING_KEYS.includes(key)) {
      tracking[key] = val;
    } else {
      extras.push({ ameliaKey: key, elementorId: val });
    }
  }
  return { main, extras, tracking };
}

function mergeFieldMap(
  main: Record<string, string>,
  extras: ExtraField[],
  tracking: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...main };
  for (const e of extras) {
    if (e.ameliaKey.trim()) result[e.ameliaKey.trim()] = e.elementorId;
  }
  for (const [k, v] of Object.entries(tracking)) {
    if (v) result[k] = v;
  }
  return result;
}

export function ElementorIntegrationManager() {
  const { empresaRecords } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFormId, setNewFormId] = useState("");
  const [newEmpresa, setNewEmpresa] = useState("TOKENIZA");
  const [newFieldMap, setNewFieldMap] = useState<Record<string, string>>({ nome: "", email: "", telefone: "" });
  const [newExtraFields, setNewExtraFields] = useState<ExtraField[]>([]);
  const [newTrackingFields, setNewTrackingFields] = useState<Record<string, string>>({});
  const [newTags, setNewTags] = useState("");
  const [newToken, setNewToken] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["elementor-form-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elementor_form_mappings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FormMapping[];
    },
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, nome, empresa")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["pipeline-stages-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, nome, pipeline_id")
        .order("posicao");
      if (error) throw error;
      return data;
    },
  });

  const [newPipelineId, setNewPipelineId] = useState("");
  const [newStageId, setNewStageId] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);

  // Reset pipeline/stage when empresa changes (skip during edit init)
  useEffect(() => {
    if (isInitializing) return;
    setNewPipelineId("");
    setNewStageId("");
  }, [newEmpresa]);

  // Reset stage when pipeline changes (skip during edit init)
  useEffect(() => {
    if (isInitializing) return;
    setNewStageId("");
  }, [newPipelineId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const fullFieldMap = mergeFieldMap(newFieldMap, newExtraFields, newTrackingFields);
      const { error } = await supabase.from("elementor_form_mappings").insert({
        form_id: newFormId.trim().toLowerCase().replace(/\s+/g, "-"),
        empresa: newEmpresa,
        pipeline_id: newPipelineId || null,
        stage_id: newStageId || null,
        field_map: fullFieldMap,
        tags_auto: newTags ? newTags.split(",").map(t => t.trim()) : [],
        token: newToken.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elementor-form-mappings"] });
      toast.success("Mapeamento criado com sucesso");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const fullFieldMap = mergeFieldMap(newFieldMap, newExtraFields, newTrackingFields);
      const { error } = await supabase.from("elementor_form_mappings").update({
        form_id: newFormId.trim().toLowerCase().replace(/\s+/g, "-"),
        empresa: newEmpresa,
        pipeline_id: newPipelineId || null,
        stage_id: newStageId || null,
        field_map: fullFieldMap,
        tags_auto: newTags ? newTags.split(",").map(t => t.trim()) : [],
        token: newToken.trim() || null,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elementor-form-mappings"] });
      toast.success("Mapeamento atualizado com sucesso");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("elementor_form_mappings")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["elementor-form-mappings"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("elementor_form_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elementor-form-mappings"] });
      toast.success("Mapeamento removido");
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setNewFormId("");
    setNewEmpresa("TOKENIZA");
    setNewPipelineId("");
    setNewStageId("");
    setNewFieldMap({ nome: "", email: "", telefone: "" });
    setNewExtraFields([]);
    setNewTrackingFields({});
    setNewTags("");
    setNewToken("");
  };

  const openEditDialog = (mapping: FormMapping) => {
    const { main, extras, tracking } = splitFieldMap(mapping.field_map as Record<string, string>);
    setEditingId(mapping.id);
    setNewFormId(mapping.form_id);
    setNewEmpresa(mapping.empresa);
    setNewPipelineId(mapping.pipeline_id || "");
    setNewStageId(mapping.stage_id || "");
    setNewFieldMap({ nome: main.nome || "", email: main.email || "", telefone: main.telefone || "" });
    setNewExtraFields(extras);
    setNewTrackingFields(tracking);
    setNewTags(mapping.tags_auto?.join(", ") || "");
    setNewToken(mapping.token || "");
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWebhookUrl = (formId: string) =>
    `${SUPABASE_URL}/functions/v1/elementor-webhook?form_id=${formId}`;

  const getPhpSnippet = (mapping: FormMapping) => {
    const { extras, tracking } = splitFieldMap(mapping.field_map as Record<string, string>);
    const hasTracking = Object.keys(tracking).length > 0;

    return `// Adicione ao functions.php do seu tema WordPress
add_action('elementor_pro/forms/new_record', function($record) {
    $fields = $record->get('fields');
    $data = ['fields' => []];
    foreach ($fields as $id => $field) {
        $data['fields'][$id] = ['value' => $field['value']];
    }
${hasTracking ? `
    // Campos de rastreio (UTMs, click IDs)
    $tracking_params = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'];
    foreach ($tracking_params as $param) {
        if (!empty($_GET[$param])) {
            $data[$param] = sanitize_text_field($_GET[$param]);
        }
    }
    // Page URL e Referrer
    $data['page_url'] = home_url(add_query_arg([], wp_get_referer() ?: ''));
    $data['referrer'] = isset($_SERVER['HTTP_REFERER']) ? esc_url_raw($_SERVER['HTTP_REFERER']) : '';
` : ''}
    $headers = ['Content-Type' => 'application/json'];
${mapping.token ? `    $headers['X-Webhook-Token'] = '${mapping.token}';` : '    // Token de autenticação não configurado'}
    wp_remote_post('${getWebhookUrl(mapping.form_id)}', [
        'headers' => $headers,
        'body' => json_encode($data),
        'timeout' => 10,
    ]);
}, 10, 1);`;
  };

  const filteredPipelines = pipelines.filter(p => p.empresa === newEmpresa);

  const filteredStages = newPipelineId
    ? stages.filter(s => s.pipeline_id === newPipelineId)
    : [];


  const addExtraField = () => {
    setNewExtraFields(prev => [...prev, { ameliaKey: "", elementorId: "" }]);
  };

  const removeExtraField = (index: number) => {
    setNewExtraFields(prev => prev.filter((_, i) => i !== index));
  };

  const updateExtraField = (index: number, field: Partial<ExtraField>) => {
    setNewExtraFields(prev => prev.map((f, i) => i === index ? { ...f, ...field } : f));
  };

  const isEditing = editingId !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Formulários Elementor</h3>
          <p className="text-sm text-muted-foreground">
            Configure mapeamentos para receber leads de formulários WordPress/Elementor
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Novo Mapeamento
        </Button>
      </div>

      {/* Shared Dialog for Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Mapeamento Elementor" : "Novo Mapeamento Elementor"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Edite os campos do mapeamento. Deixe o token vazio para aceitar requisições sem autenticação."
                : "Configure como os campos do formulário Elementor serão mapeados para a Amélia."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-5 pb-2">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID do Formulário</Label>
                  <Input
                    placeholder="oferta-publica-2025"
                    value={newFormId}
                    onChange={e => setNewFormId(e.target.value)}
                    disabled={isEditing}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Slug único para identificar o formulário</p>
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={newEmpresa} onValueChange={setNewEmpresa}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[200]">
                      {empresaRecords.filter(e => e.is_active).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pipeline</Label>
                  <Select value={newPipelineId} onValueChange={setNewPipelineId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent className="z-[200]">
                      {filteredPipelines.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estágio</Label>
                  <Select value={newStageId} onValueChange={setNewStageId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent className="z-[200]">
                      {filteredStages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Token */}
              <div>
                <Label>Token de Autenticação (opcional)</Label>
                <Input
                  placeholder="Deixe vazio para aceitar sem autenticação"
                  value={newToken}
                  onChange={e => setNewToken(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Se preenchido, o webhook exigirá o header <code className="rounded bg-muted px-1">X-Webhook-Token</code>
                </p>
              </div>

              <Separator />

              {/* Main fields */}
              <div>
                <Label className="mb-2 block text-sm font-semibold">Campos Principais</Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Informe o ID do campo no Elementor para cada campo obrigatório
                </p>
                {AMELIA_FIELDS.map(f => (
                  <div key={f.key} className="mb-2 flex items-center gap-2">
                    <Label className="w-24 shrink-0 text-sm">
                      {f.label}{f.required && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      placeholder={`Ex: field_${f.key}`}
                      value={newFieldMap[f.key] || ""}
                      onChange={e => setNewFieldMap(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Additional fields */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <Label className="block text-sm font-semibold">Campos Adicionais</Label>
                    <p className="text-xs text-muted-foreground">
                      Mapeie campos extras do formulário (empresa, cargo, CPF, etc.)
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addExtraField}>
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
                {newExtraFields.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhum campo adicional configurado</p>
                )}
                {newExtraFields.map((ef, i) => (
                  <div key={i} className="mb-2 flex items-center gap-2">
                    <Input
                      placeholder="Nome do campo (ex: empresa)"
                      value={ef.ameliaKey}
                      onChange={e => updateExtraField(i, { ameliaKey: e.target.value })}
                      className="text-xs"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">→</span>
                    <Input
                      placeholder="ID Elementor (ex: field_empresa)"
                      value={ef.elementorId}
                      onChange={e => updateExtraField(i, { elementorId: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeExtraField(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Tracking / hidden fields */}
              <div>
                <Label className="mb-1 block text-sm font-semibold">Campos Ocultos / Rastreio</Label>
                <p className="mb-3 text-xs text-muted-foreground">
                  UTMs e campos de rastreio. Informe o ID do campo hidden no Elementor, ou deixe vazio
                  para capturar automaticamente via query string.
                </p>
                <div className="space-y-2">
                  {TRACKING_FIELDS.map(tf => (
                    <div key={tf.key} className="flex items-center gap-2">
                      <Label className="w-40 shrink-0 text-xs font-medium">{tf.label}</Label>
                      <Input
                        placeholder={`ID campo ou vazio (auto via ?${tf.key}=...)`}
                        value={newTrackingFields[tf.key] || ""}
                        onChange={e => setNewTrackingFields(prev => ({ ...prev, [tf.key]: e.target.value }))}
                        className="font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label>Tags automáticas</Label>
                <Input
                  placeholder="elementor, oferta-publica"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">Separadas por vírgula</p>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!newFormId || !newFieldMap.email || isSaving}
            >
              {isEditing ? "Salvar Alterações" : "Criar Mapeamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {mappings.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Code className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum mapeamento configurado</p>
            <p className="text-xs text-muted-foreground">Crie um novo mapeamento para integrar formulários Elementor</p>
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="space-y-2">
        {mappings.map(mapping => {
          const { main, extras, tracking } = splitFieldMap(mapping.field_map as Record<string, string>);
          return (
            <AccordionItem key={mapping.id} value={mapping.id} className="rounded-lg border">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium">{mapping.form_id}</span>
                  <Badge variant="outline" className="text-xs">{mapping.empresa}</Badge>
                  <Badge variant={mapping.is_active ? "default" : "secondary"} className="text-xs">
                    {mapping.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 px-4 pb-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">URL do Webhook</Label>
                  <div className="flex items-center gap-2">
                    <Input value={getWebhookUrl(mapping.form_id)} readOnly className="font-mono text-xs" />
                    <Button
                      variant="outline" size="icon"
                      onClick={() => handleCopy(getWebhookUrl(mapping.form_id), `url-${mapping.id}`)}
                    >
                      {copiedId === `url-${mapping.id}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Token de Autenticação</Label>
                  {mapping.token ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Input value={mapping.token} readOnly className="font-mono text-xs" type="password" />
                        <Button
                          variant="outline" size="icon"
                          onClick={() => handleCopy(mapping.token!, `token-${mapping.id}`)}
                        >
                          {copiedId === `token-${mapping.id}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Enviar no header: <code className="rounded bg-muted px-1">X-Webhook-Token</code></p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sem token — webhook aceita requisições sem autenticação</p>
                  )}
                </div>

                {/* Main fields */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Campos Principais</Label>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(main).map(([key, val]) => (
                      <div key={key} className="flex gap-1">
                        <span className="font-medium">{key}:</span>
                        <span className="font-mono text-muted-foreground">{val || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional fields */}
                {extras.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Campos Adicionais</Label>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {extras.map(({ ameliaKey, elementorId }) => (
                        <div key={ameliaKey} className="flex gap-1">
                          <span className="font-medium">{ameliaKey}:</span>
                          <span className="font-mono text-muted-foreground">{elementorId || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tracking fields */}
                {Object.keys(tracking).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Campos de Rastreio</Label>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(tracking).map(([key, val]) => (
                        <div key={key} className="flex gap-1">
                          <span className="font-medium">{key}:</span>
                          <span className="font-mono text-muted-foreground">{val || "auto"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mapping.tags_auto?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {mapping.tags_auto.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Snippet PHP (WordPress)</Label>
                  <div className="relative">
                    <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
                      {getPhpSnippet(mapping)}
                    </pre>
                    <Button
                      variant="outline" size="sm"
                      className="absolute right-2 top-2 gap-1"
                      onClick={() => handleCopy(getPhpSnippet(mapping), `php-${mapping.id}`)}
                    >
                      {copiedId === `php-${mapping.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copiar
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mapping.is_active}
                      onCheckedChange={checked => toggleMutation.mutate({ id: mapping.id, is_active: checked })}
                    />
                    <span className="text-xs text-muted-foreground">{mapping.is_active ? "Ativo" : "Inativo"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => openEditDialog(mapping)}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    <Button
                      variant="destructive" size="sm"
                      onClick={() => {
                        if (confirm("Remover este mapeamento?")) deleteMutation.mutate(mapping.id);
                      }}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Remover
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
