import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PromptVersion {
  id: string;
  function_name: string;
  prompt_key: string;
  version: number;
  content: string;
  is_active: boolean;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  ab_weight: number;
  ab_group: string | null;
}

export function usePromptVersions(functionName?: string) {
  const qc = useQueryClient();

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompt-versions", functionName],
    queryFn: async () => {
      let query = supabase
        .from("prompt_versions")
        .select("*")
        .order("function_name")
        .order("version", { ascending: false });

      if (functionName) query = query.eq("function_name", functionName);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as PromptVersion[];
    },
  });

  const createVersion = useMutation({
    mutationFn: async (params: { function_name: string; prompt_key?: string; content: string; notes?: string }) => {
      // Get max version
      const { data: existing } = await supabase
        .from("prompt_versions")
        .select("version")
        .eq("function_name", params.function_name)
        .eq("prompt_key", params.prompt_key || "system")
        .order("version", { ascending: false })
        .limit(1);

      const nextVersion = ((existing?.[0] as { version?: number } | undefined)?.version || 0) + 1;

      // Deactivate old
      await supabase
        .from("prompt_versions")
        .update({ is_active: false })
        .eq("function_name", params.function_name)
        .eq("prompt_key", params.prompt_key || "system");

      // Insert new
      const { error } = await supabase.from("prompt_versions").insert({
        function_name: params.function_name,
        prompt_key: params.prompt_key || "system",
        version: nextVersion,
        content: params.content,
        notes: params.notes,
        is_active: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompt-versions"] });
      toast.success("Nova versão do prompt salva");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  return { prompts, isLoading, createVersion };
}
