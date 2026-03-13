import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, Eye, EyeOff } from "lucide-react";

interface MauticConfig {
  id: string;
  empresa: string;
  mautic_url: string;
  mautic_username: string | null;
  mautic_password: string | null;
  segment_ids: Record<string, string>;
  custom_fields: Record<string, string>;
  enabled: boolean;
  updated_at: string;
}

interface ConfigForm {
  mautic_url: string;
  mautic_username: string;
  mautic_password: string;
  segment_ids: Array<{ pipeline_id: string; segment_id: string }>;
  custom_fields: Array<{ local: string; mautic: string }>;
  enabled: boolean;
}

interface PipelineOption {
  id: string;
  nome: string;
  empresa: string;
}

const emptyForm = (): ConfigForm => ({
  mautic_url: "",
  mautic_username: "",
  mautic_password: "",
  segment_ids: [],
  custom_fields: [],
  enabled: false,
});

function configToForm(config: MauticConfig): ConfigForm {
  const fields = config.custom_fields || {};
  const segments = config.segment_ids || {};
  return {
    mautic_url: config.mautic_url || "",
    mautic_username: config.mautic_username || "",
    mautic_password: config.mautic_password || "",
    segment_ids: Object.entries(segments).map(([pipeline_id, segment_id]) => ({ pipeline_id, segment_id })),
    custom_fields: Object.entries(fields).map(([local, mautic]) => ({ local, mautic })),
    enabled: config.enabled,
  };
}

export function MauticConfigManager() {
  const queryClient = useQueryClient();
  const [forms, setForms] = useState<Record<string, ConfigForm>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const { data: empresas, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas" as any)
        .select("id, label, is_active")
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return data as unknown as Array<{ id: string; label: string }>;
    },
  });

  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ["mautic-company-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mautic_company_config" as any)
        .select("*")
        .order("empresa");
      if (error) throw error;
      return data as unknown as MauticConfig[];
    },
  });

  const { data: pipelines } = useQuery({
    queryKey: ["all-pipelines-for-mautic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, nome, empresa")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as PipelineOption[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ empresa, form }: { empresa: string; form: ConfigForm }) => {
      const customFieldsObj: Record<string, string> = {};
      form.custom_fields.forEach((f) => {
        if (f.local.trim() && f.mautic.trim()) {
          customFieldsObj[f.local.trim()] = f.mautic.trim();
        }
      });

      const segmentIdsObj: Record<string, string> = {};
      form.segment_ids.forEach((s) => {
        if (s.pipeline_id.trim() && s.segment_id.trim()) {
          segmentIdsObj[s.pipeline_id.trim()] = s.segment_id.trim();
        }
      });

      const { error } = await supabase
        .from("mautic_company_config" as any)
        .upsert(
          {
            empresa,
            mautic_url: form.mautic_url,
            mautic_username: form.mautic_username || null,
            mautic_password: form.mautic_password || null,
            segment_ids: segmentIdsObj,
            custom_fields: customFieldsObj,
            enabled: form.enabled,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "empresa" }
        );
      if (error) throw error;
    },
    onSuccess: (_, { empresa }) => {
      queryClient.invalidateQueries({ queryKey: ["mautic-company-config"] });
      setDirty((d) => ({ ...d, [empresa]: false }));
      toast.success(`Configuração Mautic salva para ${empresa}`);
    },
    onError: (err) => {
      toast.error("Erro ao salvar configuração Mautic", { description: err.message });
    },
  });

  const getForm = (empresa: string): ConfigForm => {
    if (forms[empresa]) return forms[empresa];
    const existing = configs?.find((c) => c.empresa === empresa);
    return existing ? configToForm(existing) : emptyForm();
  };

  const updateForm = (empresa: string, partial: Partial<ConfigForm>) => {
    const current = getForm(empresa);
    setForms((f) => ({ ...f, [empresa]: { ...current, ...partial } }));
    setDirty((d) => ({ ...d, [empresa]: true }));
  };

  const updateCustomField = (empresa: string, index: number, key: "local" | "mautic", value: string) => {
    const form = getForm(empresa);
    const fields = [...form.custom_fields];
    fields[index] = { ...fields[index], [key]: value };
    updateForm(empresa, { custom_fields: fields });
  };

  const addCustomField = (empresa: string) => {
    const form = getForm(empresa);
    updateForm(empresa, { custom_fields: [...form.custom_fields, { local: "", mautic: "" }] });
  };

  const removeCustomField = (empresa: string, index: number) => {
    const form = getForm(empresa);
    updateForm(empresa, { custom_fields: form.custom_fields.filter((_, i) => i !== index) });
  };

  const updateSegment = (empresa: string, index: number, key: "pipeline_id" | "segment_id", value: string) => {
    const form = getForm(empresa);
    const segs = [...form.segment_ids];
    segs[index] = { ...segs[index], [key]: value };
    updateForm(empresa, { segment_ids: segs });
  };

  const addSegment = (empresa: string) => {
    const form = getForm(empresa);
    updateForm(empresa, { segment_ids: [...form.segment_ids, { pipeline_id: "", segment_id: "" }] });
  };

  const removeSegment = (empresa: string, index: number) => {
    const form = getForm(empresa);
    updateForm(empresa, { segment_ids: form.segment_ids.filter((_, i) => i !== index) });
  };

  const getPipelinesForEmpresa = (empresaId: string) => {
    return pipelines?.filter((p) => p.empresa === empresaId) || [];
  };

  if (loadingEmpresas || loadingConfigs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando configurações Mautic...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Integração Mautic</h3>
        <p className="text-sm text-muted-foreground">
          Configure conexões Mautic por empresa com URL, credenciais, segmentos por funil e campos personalizados.
        </p>
      </div>

      {empresas?.map((emp) => {
        const form = getForm(emp.id);
        const existingConfig = configs?.find((c) => c.empresa === emp.id);
        const isDirty = dirty[emp.id];
        const empPipelines = getPipelinesForEmpresa(emp.id);

        return (
          <Card key={emp.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{emp.label}</CardTitle>
                  {existingConfig?.enabled && (
                    <Badge variant="default" className="text-xs">Ativo</Badge>
                  )}
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(enabled) => updateForm(emp.id, { enabled })}
                />
              </div>
              <CardDescription>{emp.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>URL do Mautic</Label>
                  <Input
                    placeholder="https://mautic.exemplo.com"
                    value={form.mautic_url}
                    onChange={(e) => updateForm(emp.id, { mautic_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="Usuário do Mautic"
                    value={form.mautic_username}
                    onChange={(e) => updateForm(emp.id, { mautic_username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword[emp.id] ? "text" : "password"}
                      placeholder="Senha do Mautic"
                      value={form.mautic_password}
                      onChange={(e) => updateForm(emp.id, { mautic_password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword((s) => ({ ...s, [emp.id]: !s[emp.id] }))}
                    >
                      {showPassword[emp.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Segment IDs per pipeline */}
              <div className="space-y-2">
                <Label>Segmentos por Funil (pipeline → ID do segmento Mautic)</Label>
                {form.segment_ids.map((seg, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={seg.pipeline_id}
                      onValueChange={(val) => updateSegment(emp.id, idx, "pipeline_id", val)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione o funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {empPipelines.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">→</span>
                    <Input
                      placeholder="ID do segmento (ex: 5)"
                      value={seg.segment_id}
                      onChange={(e) => updateSegment(emp.id, idx, "segment_id", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSegment(emp.id, idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSegment(emp.id)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar segmento
                </Button>
              </div>

              {/* Custom fields mapping */}
              <div className="space-y-2">
                <Label>Campos Personalizados (campo local → campo Mautic)</Label>
                {form.custom_fields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Campo local (ex: cpf)"
                      value={field.local}
                      onChange={(e) => updateCustomField(emp.id, idx, "local", e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">→</span>
                    <Input
                      placeholder="Campo Mautic (ex: custom_cpf)"
                      value={field.mautic}
                      onChange={(e) => updateCustomField(emp.id, idx, "mautic", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomField(emp.id, idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomField(emp.id)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar campo
                </Button>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => upsertMutation.mutate({ empresa: emp.id, form })}
                  disabled={upsertMutation.isPending || !isDirty}
                  className="gap-2"
                >
                  {upsertMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
