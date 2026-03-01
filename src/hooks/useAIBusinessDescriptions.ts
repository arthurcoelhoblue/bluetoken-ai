import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AIBusinessDescription {
  id: string;
  empresa: string;
  descricao: string;
  regras_criticas: string | null;
  identidade: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useAIBusinessDescriptions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ai_business_descriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_business_descriptions").select("*").order("empresa");
      if (error) throw error;
      return data as AIBusinessDescription[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (desc: Partial<AIBusinessDescription> & { id?: string }) => {
      if (desc.id) {
        const { error } = await supabase.from("ai_business_descriptions").update(desc).eq("id", desc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_business_descriptions").insert(desc as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_business_descriptions"] });
      toast.success("Descrição salva");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return { descriptions: query.data || [], isLoading: query.isLoading, upsert };
}
