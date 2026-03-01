import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAIInstructions, AIInstruction, AIInstructionTipo } from "@/hooks/useAIInstructions";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";

const TIPO_LABELS: Record<AIInstructionTipo, string> = {
  PERSONA: "Persona",
  TOM: "Tom de Voz",
  COMPLIANCE: "Compliance",
  CANAL: "Canal",
  PROCESSO: "Processo",
};

const TIPO_COLORS: Record<AIInstructionTipo, string> = {
  PERSONA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  TOM: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  COMPLIANCE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  CANAL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PROCESSO: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function AiInstructionsTab() {
  const { instructions, isLoading, upsert, remove } = useAIInstructions();
  const [editingItem, setEditingItem] = useState<Partial<AIInstruction> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = () => {
    if (!editingItem?.titulo || !editingItem?.conteudo || !editingItem?.tipo) return;
    upsert.mutate(editingItem as any, {
      onSuccess: () => { setDialogOpen(false); setEditingItem(null); },
    });
  };

  const handleNew = () => {
    setEditingItem({ empresa: "ALL", tipo: "PROCESSO", titulo: "", conteudo: "", ordem: 0, ativo: true });
    setDialogOpen(true);
  };

  const handleEdit = (item: AIInstruction) => {
    setEditingItem({ ...item });
    setDialogOpen(true);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const grouped = instructions.reduce((acc, i) => {
    const key = i.tipo as AIInstructionTipo;
    if (!acc[key]) acc[key] = [];
    acc[key].push(i);
    return acc;
  }, {} as Record<AIInstructionTipo, AIInstruction[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Instruções da IA</h3>
          <p className="text-sm text-muted-foreground">Configure persona, tom, compliance e processos sem deploy</p>
        </div>
        <Button onClick={handleNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Instrução
        </Button>
      </div>

      {(Object.keys(TIPO_LABELS) as AIInstructionTipo[]).map((tipo) => {
        const items = grouped[tipo] || [];
        return (
          <Card key={tipo}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {TIPO_LABELS[tipo]}
                <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma instrução</p>}
              {items.map((item) => (
                <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${item.ativo ? "bg-card" : "bg-muted/50 opacity-60"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{item.titulo}</span>
                      <Badge variant="outline" className={TIPO_COLORS[tipo]}>{item.empresa}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{item.conteudo}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={item.ativo} onCheckedChange={(checked) => upsert.mutate({ id: item.id, ativo: checked })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? "Editar Instrução" : "Nova Instrução"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={editingItem?.tipo || ""} onValueChange={(v) => setEditingItem((p) => ({ ...p!, tipo: v as AIInstructionTipo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABELS) as AIInstructionTipo[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input value={editingItem?.titulo || ""} onChange={(e) => setEditingItem((p) => ({ ...p!, titulo: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea value={editingItem?.conteudo || ""} onChange={(e) => setEditingItem((p) => ({ ...p!, conteudo: e.target.value }))} rows={8} />
            </div>
            <div>
              <label className="text-sm font-medium">Ordem</label>
              <Input type="number" value={editingItem?.ordem || 0} onChange={(e) => setEditingItem((p) => ({ ...p!, ordem: parseInt(e.target.value) || 0 }))} />
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
