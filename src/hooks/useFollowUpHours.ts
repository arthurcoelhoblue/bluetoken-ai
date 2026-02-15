import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OptimalHour {
  dia_semana: number;
  hora: number;
  taxa_resposta: number;
  total_envios: number;
}

export function useFollowUpHours(empresa?: string) {
  return useQuery({
    queryKey: ["follow-up-hours", empresa],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_up_optimal_hours")
        .select("dia_semana, hora, taxa_resposta, total_envios")
        .eq("empresa", empresa!)
        .order("taxa_resposta", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as OptimalHour[];
    },
  });
}

export function getBestSendTime(hours: OptimalHour[]): string {
  if (!hours || hours.length === 0) return "Sem dados suficientes";
  const top = hours[0];
  const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return `${dias[top.dia_semana]} às ${top.hora}h (${top.taxa_resposta.toFixed(0)}% resposta)`;
}
