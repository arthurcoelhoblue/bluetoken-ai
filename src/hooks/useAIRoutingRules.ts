import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface AIRoutingRule {
  id: string;
  empresa: string;
  intent: string;
  condicao: Json;
  acao: string;
  resposta_padrao: string | null;
  prioridade: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useAIRoutingRules(empresa?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ai_routing_rules", empresa],
    queryFn: async () => {
      let q = supabase.from("ai_routing_rules").select("*").order("prioridade", { ascending: false });
      if (empresa && empresa !== "ALL") {
        q = q.or(`empresa.eq.${empresa},empresa.eq.ALL`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as AIRoutingRule[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (rule: Partial<AIRoutingRule> & { id?: string }) => {
      if (rule.id) {
        const { error } = await supabase.from("ai_routing_rules").update(rule).eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_routing_rules").insert(rule as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_routing_rules"] });
      toast.success("Regra salva");
    },
    onError: (e: Error) => toast.error("Erro ao salvar regra", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_routing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_routing_rules"] });
      toast.success("Regra removida");
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  return { rules: query.data || [], isLoading: query.isLoading, upsert, remove };
}
