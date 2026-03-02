import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type WhatsAppConnection = Database["public"]["Tables"]["whatsapp_connections"]["Row"];
type WhatsAppConnectionInsert = Database["public"]["Tables"]["whatsapp_connections"]["Insert"];
type WhatsAppConnectionUpdate = Database["public"]["Tables"]["whatsapp_connections"]["Update"];

export function useWhatsAppConnections() {
  const queryClient = useQueryClient();
  const queryKey = ["whatsapp-connections"];

  const { data: connections = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .order("empresa")
        .order("is_default", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return data as WhatsAppConnection[];
    },
  });

  const createConnection = useMutation({
    mutationFn: async (input: WhatsAppConnectionInsert) => {
      // If setting as default, unset others for same empresa
      if (input.is_default) {
        await supabase
          .from("whatsapp_connections")
          .update({ is_default: false })
          .eq("empresa", input.empresa);
      }
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Conexão criada com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar conexão", { description: err.message });
    },
  });

  const updateConnection = useMutation({
    mutationFn: async ({ id, ...updates }: WhatsAppConnectionUpdate & { id: string }) => {
      // If setting as default, get empresa first then unset others
      if (updates.is_default) {
        const conn = connections.find((c) => c.id === id);
        if (conn) {
          await supabase
            .from("whatsapp_connections")
            .update({ is_default: false })
            .eq("empresa", conn.empresa)
            .neq("id", id);
        }
      }
      const { error } = await supabase
        .from("whatsapp_connections")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Conexão atualizada");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar", { description: err.message });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_connections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Conexão removida");
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover", { description: err.message });
    },
  });

  // Group by empresa
  const connectionsByEmpresa = connections.reduce<Record<string, WhatsAppConnection[]>>((acc, conn) => {
    const key = conn.empresa as string;
    if (!acc[key]) acc[key] = [];
    acc[key].push(conn);
    return acc;
  }, {});

  return {
    connections,
    connectionsByEmpresa,
    isLoading,
    createConnection,
    updateConnection,
    deleteConnection,
  };
}
