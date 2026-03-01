import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAIRoutingRules, AIRoutingRule } from "@/hooks/useAIRoutingRules";
import { Plus, Pencil, Trash2, Route } from "lucide-react";

const ACOES = [
  "ENVIAR_RESPOSTA_AUTOMATICA", "ESCALAR_HUMANO", "AJUSTAR_TEMPERATURA",
  "PAUSAR_CADENCIA", "CANCELAR_CADENCIA", "RETOMAR_CADENCIA",
  "CRIAR_TAREFA_CLOSER", "MARCAR_OPT_OUT", "DESQUALIFICAR_LEAD", "NENHUMA",
];

const INTENTS = [
  "INTERESSE_COMPRA", "INTERESSE_IR", "DUVIDA_PRODUTO", "DUVIDA_PRECO",
  "DUVIDA_TECNICA", "SOLICITACAO_CONTATO", "AGENDAMENTO_REUNIAO",
  "RECLAMACAO", "OPT_OUT", "OBJECAO_PRECO", "OBJECAO_RISCO",
  "SEM_INTERESSE", "NAO_ENTENDI", "CUMPRIMENTO", "AGRADECIMENTO",
  "FORA_CONTEXTO", "OUTRO",
];

export function AiRoutingRulesTab() {
  const { rules, isLoading, upsert, remove } = useAIRoutingRules();
  const [editingItem, setEditingItem] = useState<Partial<AIRoutingRule> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = () => {
    if (!editingItem?.intent || !editingItem?.acao) return;
    const toSave = { ...editingItem };
    if (typeof toSave.condicao === "string") {
      try { toSave.condicao = JSON.parse(toSave.condicao as any); } catch { toSave.condicao = {}; }
    }
    upsert.mutate(toSave as any, {
      onSuccess: () => { setDialogOpen(false); setEditingItem(null); },
    });
  };

  const handleNew = () => {
    setEditingItem({ empresa: "ALL", intent: "INTERESSE_COMPRA", condicao: {}, acao: "ENVIAR_RESPOSTA_AUTOMATICA", resposta_padrao: "", prioridade: 0, ativo: true });
    setDialogOpen(true);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Regras de Roteamento</h3>
          <p className="text-sm text-muted-foreground">Define ações automáticas por intent (ex: escalar, responder, pausar cadência)</p>
        </div>
        <Button onClick={handleNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Regra
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          {rules.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra configurada</p>}
          {rules.map((rule) => (
            <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-lg border ${rule.ativo ? "bg-card" : "bg-muted/50 opacity-60"}`}>
              <Route className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{rule.empresa}</Badge>
                  <Badge>{rule.intent}</Badge>
                  <span className="text-xs text-muted-foreground">→</span>
                  <Badge variant="secondary">{rule.acao}</Badge>
                  <Badge variant="outline" className="ml-auto">P{rule.prioridade}</Badge>
                </div>
                {rule.resposta_padrao && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{rule.resposta_padrao}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={rule.ativo} onCheckedChange={(checked) => upsert.mutate({ id: rule.id, ativo: checked })} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem({ ...rule, condicao: rule.condicao }); setDialogOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(rule.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Intent</label>
                <Select value={editingItem?.intent || ""} onValueChange={(v) => setEditingItem((p) => ({ ...p!, intent: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INTENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Ação</label>
                <Select value={editingItem?.acao || ""} onValueChange={(v) => setEditingItem((p) => ({ ...p!, acao: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACOES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <Select value={editingItem?.empresa || "ALL"} onValueChange={(v) => setEditingItem((p) => ({ ...p!, empresa: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    <SelectItem value="BLUE">Blue</SelectItem>
                    <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                    <SelectItem value="MPUPPE">MPuppe</SelectItem>
                    <SelectItem value="AXIA">Axia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Input type="number" value={editingItem?.prioridade || 0} onChange={(e) => setEditingItem((p) => ({ ...p!, prioridade: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Condição (JSON)</label>
              <Textarea value={typeof editingItem?.condicao === "string" ? editingItem.condicao : JSON.stringify(editingItem?.condicao || {}, null, 2)} onChange={(e) => setEditingItem((p) => ({ ...p!, condicao: e.target.value as any }))} rows={4} className="font-mono text-xs" />
            </div>
            <div>
              <label className="text-sm font-medium">Resposta Padrão (opcional)</label>
              <Textarea value={editingItem?.resposta_padrao || ""} onChange={(e) => setEditingItem((p) => ({ ...p!, resposta_padrao: e.target.value }))} rows={3} />
            </div>
            <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
