import { useState } from "react";
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
import { Plus, Copy, Check, Trash2, Code, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

const AMELIA_FIELDS = [
  { key: "nome", label: "Nome", required: true },
  { key: "email", label: "Email", required: true },
  { key: "telefone", label: "Telefone", required: false },
];

interface FormMapping {
  id: string;
  form_id: string;
  empresa: string;
  pipeline_id: string | null;
  stage_id: string | null;
  field_map: Record<string, string>;
  tags_auto: string[];
  token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function ElementorIntegrationManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFormId, setNewFormId] = useState("");
  const [newEmpresa, setNewEmpresa] = useState("TOKENIZA");
  const [newFieldMap, setNewFieldMap] = useState<Record<string, string>>({ nome: "", email: "", telefone: "" });
  const [newTags, setNewTags] = useState("");
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("elementor_form_mappings").insert({
        form_id: newFormId.trim().toLowerCase().replace(/\s+/g, "-"),
        empresa: newEmpresa,
        pipeline_id: newPipelineId || null,
        stage_id: newStageId || null,
        field_map: newFieldMap,
        tags_auto: newTags ? newTags.split(",").map(t => t.trim()) : [],
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
    setNewFormId("");
    setNewEmpresa("TOKENIZA");
    setNewPipelineId("");
    setNewStageId("");
    setNewFieldMap({ nome: "", email: "", telefone: "" });
    setNewTags("");
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWebhookUrl = (formId: string) =>
    `${SUPABASE_URL}/functions/v1/elementor-webhook?form_id=${formId}`;

  const getPhpSnippet = (mapping: FormMapping) => `// Adicione ao functions.php do seu tema WordPress
add_action('elementor_pro/forms/new_record', function($record) {
    $form_name = $record->get_form_settings('form_name');
    
    // Ajuste o nome do formulário conforme necessário
    $fields = $record->get('fields');
    $data = ['fields' => []];
    foreach ($fields as $id => $field) {
        $data['fields'][$id] = ['value' => $field['value']];
    }

    wp_remote_post('${getWebhookUrl(mapping.form_id)}', [
        'headers' => [
            'Content-Type' => 'application/json',
            'X-Webhook-Token' => '${mapping.token}',
        ],
        'body' => json_encode($data),
        'timeout' => 10,
    ]);
}, 10, 1);`;

  const filteredStages = newPipelineId
    ? stages.filter(s => s.pipeline_id === newPipelineId)
    : stages;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Formulários Elementor</h3>
          <p className="text-sm text-muted-foreground">
            Configure mapeamentos para receber leads de formulários WordPress/Elementor
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Mapeamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Mapeamento Elementor</DialogTitle>
              <DialogDescription>
                Configure como os campos do formulário Elementor serão mapeados para a Amélia.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID do Formulário</Label>
                  <Input
                    placeholder="oferta-publica-2025"
                    value={newFormId}
                    onChange={e => setNewFormId(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Slug único para identificar o formulário</p>
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={newEmpresa} onValueChange={setNewEmpresa}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                      <SelectItem value="BLUE">Blue</SelectItem>
                      <SelectItem value="MPUPPE">MPuppe</SelectItem>
                      <SelectItem value="AXIA">Axia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pipeline</Label>
                  <Select value={newPipelineId} onValueChange={setNewPipelineId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {pipelines.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} ({p.empresa})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estágio</Label>
                  <Select value={newStageId} onValueChange={setNewStageId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {filteredStages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Mapeamento de Campos</Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Informe o ID do campo no Elementor para cada campo da Amélia
                </p>
                {AMELIA_FIELDS.map(f => (
                  <div key={f.key} className="mb-2 flex items-center gap-2">
                    <Label className="w-24 text-sm">
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newFormId || !newFieldMap.email || createMutation.isPending}
              >
                Criar Mapeamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
        {mappings.map(mapping => (
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
                <div className="flex items-center gap-2">
                  <Input value={mapping.token} readOnly className="font-mono text-xs" type="password" />
                  <Button
                    variant="outline" size="icon"
                    onClick={() => handleCopy(mapping.token, `token-${mapping.id}`)}
                  >
                    {copiedId === `token-${mapping.id}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Enviar no header: <code className="rounded bg-muted px-1">X-Webhook-Token</code></p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Mapeamento de Campos</Label>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(mapping.field_map as Record<string, string>).map(([key, val]) => (
                    <div key={key} className="flex gap-1">
                      <span className="font-medium">{key}:</span>
                      <span className="font-mono text-muted-foreground">{val || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

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
                <Button
                  variant="destructive" size="sm"
                  onClick={() => {
                    if (confirm("Remover este mapeamento?")) deleteMutation.mutate(mapping.id);
                  }}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Remover
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
