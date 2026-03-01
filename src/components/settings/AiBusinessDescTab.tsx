import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAIBusinessDescriptions, AIBusinessDescription } from "@/hooks/useAIBusinessDescriptions";
import { Building2, Save } from "lucide-react";

export function AiBusinessDescTab() {
  const { descriptions, isLoading, upsert } = useAIBusinessDescriptions();
  const [editing, setEditing] = useState<Record<string, Partial<AIBusinessDescription>>>({});

  const handleChange = (id: string, field: string, value: string | boolean) => {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], id, [field]: value },
    }));
  };

  const handleSave = (id: string) => {
    const changes = editing[id];
    if (!changes) return;
    upsert.mutate(changes, {
      onSuccess: () => setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; }),
    });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Descrição do Negócio</h3>
        <p className="text-sm text-muted-foreground">Identidade e regras críticas por empresa — usadas pela IA para contexto</p>
      </div>

      {descriptions.map((desc) => {
        const changes = editing[desc.id] || {};
        const hasChanges = Object.keys(changes).length > 0;
        return (
          <Card key={desc.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {desc.empresa}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={changes.ativo ?? desc.ativo}
                    onCheckedChange={(v) => handleChange(desc.id, "ativo", v)}
                  />
                  {hasChanges && (
                    <Button size="sm" onClick={() => handleSave(desc.id)} disabled={upsert.isPending} className="gap-1">
                      <Save className="h-3 w-3" /> Salvar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={changes.descricao ?? desc.descricao}
                  onChange={(e) => handleChange(desc.id, "descricao", e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Identidade (injetada no prompt)</label>
                <Textarea
                  value={changes.identidade ?? desc.identidade ?? ""}
                  onChange={(e) => handleChange(desc.id, "identidade", e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Regras Críticas</label>
                <Textarea
                  value={changes.regras_criticas ?? desc.regras_criticas ?? ""}
                  onChange={(e) => handleChange(desc.id, "regras_criticas", e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
