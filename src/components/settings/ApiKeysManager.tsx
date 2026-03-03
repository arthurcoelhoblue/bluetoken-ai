import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Key, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ApiKeyItem {
  id: string;
  empresa: string;
  label: string;
  key_preview: string;
  permissions: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export function ApiKeysManager() {
  const { activeCompany, empresaRecords } = useCompany();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmpresa, setNewEmpresa] = useState(activeCompany || "");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [showRawKey, setShowRawKey] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys", activeCompany],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("api-keys-manage", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: null,
      });
      // The invoke for GET needs query params — we use POST workaround or fetch directly
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-keys-manage?empresa=${activeCompany || ""}`,
        { headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) throw new Error("Erro ao carregar API keys");
      return (await res.json()) as ApiKeyItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("api-keys-manage", {
        method: "POST",
        body: { empresa: newEmpresa, label: newLabel },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setRawKey(data.raw_key);
      setShowCreate(false);
      setNewLabel("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API Key criada com sucesso");
    },
    onError: (err) => toast.error("Erro ao criar key: " + String(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase.functions.invoke("api-keys-manage", {
        method: "PATCH",
        body: { id, is_active },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Status atualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-keys-manage?id=${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        }
      );
      if (!res.ok) throw new Error("Erro ao deletar");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API Key removida");
      setDeleteId(null);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Gere tokens para integrar sistemas externos (ex: LP com IA)
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Key
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !keys?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma API Key criada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{k.empresa}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">...{k.key_preview}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.is_active ? "default" : "secondary"}>
                        {k.is_active ? "Ativa" : "Revogada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.last_used_at ? format(new Date(k.last_used_at), "dd/MM HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(k.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => toggleMutation.mutate({ id: k.id, is_active: !k.is_active })}
                          title={k.is_active ? "Revogar" : "Ativar"}
                        >
                          {k.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => setDeleteId(k.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
            <DialogDescription>
              O token será exibido apenas uma vez após a criação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input
                placeholder="Ex: LP com IA - Produção"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={newEmpresa} onValueChange={setNewEmpresa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresaRecords.filter(e => e.is_active).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newLabel || !newEmpresa || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raw key display dialog */}
      <Dialog open={!!rawKey} onOpenChange={() => setRawKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔑 API Key Gerada</DialogTitle>
            <DialogDescription>
              Copie agora — este token <strong>não será exibido novamente</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
              <code className="flex-1 break-all text-sm font-mono">
                {showRawKey ? rawKey : "••••••••-••••-••••-••••-••••••••••••"}
              </code>
              <Button variant="ghost" size="icon" onClick={() => setShowRawKey(!showRawKey)}>
                {showRawKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => rawKey && copyToClipboard(rawKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole esta key no campo de configuração do LP com IA para conectar automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setRawKey(null)}>Entendi, já copiei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é irreversível. Sistemas que usam esta key perderão acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
