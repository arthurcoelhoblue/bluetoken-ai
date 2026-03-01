import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AIInstructionTipo = 'PERSONA' | 'TOM' | 'COMPLIANCE' | 'CANAL' | 'PROCESSO';

export interface AIInstruction {
  id: string;
  empresa: string;
  tipo: AIInstructionTipo;
  titulo: string;
  conteudo: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useAIInstructions(empresa?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["ai_instructions", empresa],
    queryFn: async () => {
      let q = supabase.from("ai_instructions").select("*").order("tipo").order("ordem");
      if (empresa && empresa !== "ALL") {
        q = q.or(`empresa.eq.${empresa},empresa.eq.ALL`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as AIInstruction[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (instruction: Partial<AIInstruction> & { id?: string }) => {
      if (instruction.id) {
        const { error } = await supabase.from("ai_instructions").update(instruction).eq("id", instruction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_instructions").insert(instruction as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_instructions"] });
      toast.success("Instrução salva");
    },
    onError: (e: Error) => toast.error("Erro ao salvar instrução", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_instructions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_instructions"] });
      toast.success("Instrução removida");
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  return { instructions: query.data || [], isLoading: query.isLoading, upsert, remove };
}
