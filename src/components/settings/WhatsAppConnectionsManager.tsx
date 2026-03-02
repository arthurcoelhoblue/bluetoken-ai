import { useState } from "react";
import { useWhatsAppConnections } from "@/hooks/useWhatsAppConnections";
import { useCompany } from "@/contexts/CompanyContext";
import { AddEditConnectionDialog } from "./AddEditConnectionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type WhatsAppConnection = Database["public"]["Tables"]["whatsapp_connections"]["Row"];

export function WhatsAppConnectionsManager() {
  const {
    connectionsByEmpresa,
    isLoading,
    createConnection,
    updateConnection,
    deleteConnection,
  } = useWhatsAppConnections();
  const { getCompanyLabel } = useCompany();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<WhatsAppConnection | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = () => {
    setEditingConnection(null);
    setDialogOpen(true);
  };

  const handleEdit = (conn: WhatsAppConnection) => {
    setEditingConnection(conn);
    setDialogOpen(true);
  };

  const handleSubmit = (values: any) => {
    if (editingConnection) {
      updateConnection.mutate(
        {
          id: editingConnection.id,
          phone_number_id: values.phone_number_id,
          business_account_id: values.business_account_id,
          label: values.label || null,
          display_phone: values.display_phone || null,
          verified_name: values.verified_name || null,
          is_default: values.is_default,
          access_token: values.access_token || null,
          app_secret: values.app_secret || null,
        } as any,
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createConnection.mutate(
        {
          empresa: values.empresa as Database["public"]["Enums"]["empresa_tipo"],
          phone_number_id: values.phone_number_id,
          business_account_id: values.business_account_id,
          label: values.label || null,
          display_phone: values.display_phone || null,
          verified_name: values.verified_name || null,
          is_default: values.is_default,
          access_token: values.access_token || null,
          app_secret: values.app_secret || null,
        } as any,
        { onSuccess: () => setDialogOpen(false) }
      );
    }
  };

  const handleToggleActive = (conn: WhatsAppConnection) => {
    updateConnection.mutate({ id: conn.id, is_active: !conn.is_active });
  };

  const handleSetDefault = (conn: WhatsAppConnection) => {
    updateConnection.mutate({ id: conn.id, is_default: true });
  };

  const handleConfirmDelete = () => {
    if (deletingId) {
      deleteConnection.mutate(deletingId, {
        onSuccess: () => setDeletingId(null),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const empresas = Object.keys(connectionsByEmpresa);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Conexões WhatsApp</h3>
        <Button size="sm" onClick={handleAdd} className="gap-1">
          <Plus className="h-4 w-4" />
          Adicionar Número
        </Button>
      </div>

      {empresas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma conexão WhatsApp cadastrada. Clique em "Adicionar Número" para começar.
        </div>
      ) : (
        empresas.map((empresa) => (
          <div key={empresa} className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              {getCompanyLabel(empresa)}
            </h4>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="hidden md:table-cell">Phone Number ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectionsByEmpresa[empresa].map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {conn.label || "Sem label"}
                          {conn.is_default && (
                            <Badge variant="default" className="text-xs gap-1">
                              <Star className="h-3 w-3" />
                              Padrão
                            </Badge>
                          )}
                        </div>
                        {conn.verified_name && (
                          <p className="text-xs text-muted-foreground">{conn.verified_name}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {conn.display_phone || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs">{conn.phone_number_id}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={conn.is_active}
                            onCheckedChange={() => handleToggleActive(conn)}
                            disabled={updateConnection.isPending}
                          />
                          <span className="text-xs text-muted-foreground">
                            {conn.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!conn.is_default && conn.is_active && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Definir como padrão"
                              onClick={() => handleSetDefault(conn)}
                              disabled={updateConnection.isPending}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEdit(conn)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingId(conn.id)}
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
          </div>
        ))
      )}

      <AddEditConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connection={editingConnection}
        onSubmit={handleSubmit}
        isPending={createConnection.isPending || updateConnection.isPending}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conexão será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
