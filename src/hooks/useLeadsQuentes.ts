import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadQuente {
  id: string;
  lead_id: string;
  empresa: "TOKENIZA" | "BLUE";
  motivo: string;
  created_at: string;
  // Lead contact info
  nome: string | null;
  telefone: string | null;
  email: string | null;
  // Classification
  temperatura: "FRIO" | "MORNO" | "QUENTE" | null;
  icp: string | null;
  // Conversation state
  estado_funil: string | null;
  framework_ativo: string | null;
  perfil_disc: string | null;
  // Intent details
  intent?: string;
  intent_summary?: string;
  acao_recomendada?: string;
}

export function useLeadsQuentes() {
  return useQuery({
    queryKey: ["leads-quentes"],
    queryFn: async () => {
      // Buscar intents com ações que precisam de closer
      const { data: intents, error: intentsError } = await supabase
        .from("lead_message_intents")
        .select(`
          id,
          lead_id,
          empresa,
          intent,
          intent_summary,
          acao_recomendada,
          created_at
        `)
        .in("acao_recomendada", ["CRIAR_TAREFA_CLOSER", "ESCALAR_HUMANO"])
        .eq("acao_aplicada", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (intentsError) throw intentsError;

      // Buscar classificações quentes
      const { data: classifications, error: classError } = await supabase
        .from("lead_classifications")
        .select("lead_id, empresa, temperatura, icp")
        .eq("temperatura", "QUENTE")
        .order("classificado_em", { ascending: false })
        .limit(50);

      if (classError) throw classError;

      // Combinar leads únicos
      const leadsMap = new Map<string, Partial<LeadQuente>>();

      // Adicionar de intents
      for (const intent of intents || []) {
        const key = `${intent.lead_id}-${intent.empresa}`;
        if (!leadsMap.has(key)) {
          leadsMap.set(key, {
            id: intent.id,
            lead_id: intent.lead_id || "",
            empresa: intent.empresa,
            motivo: intent.acao_recomendada === "CRIAR_TAREFA_CLOSER" 
              ? "Ação criar tarefa closer" 
              : "Escalar para humano",
            created_at: intent.created_at,
            intent: intent.intent,
            intent_summary: intent.intent_summary || undefined,
            acao_recomendada: intent.acao_recomendada,
          });
        }
      }

      // Adicionar de classificações quentes (se não estiver já)
      for (const classification of classifications || []) {
        const key = `${classification.lead_id}-${classification.empresa}`;
        if (!leadsMap.has(key)) {
          leadsMap.set(key, {
            id: `class-${classification.lead_id}`,
            lead_id: classification.lead_id,
            empresa: classification.empresa,
            motivo: "Lead temperatura quente",
            temperatura: classification.temperatura,
            icp: classification.icp,
            created_at: new Date().toISOString(),
          });
        } else {
          // Atualizar temperatura se já existe
          const existing = leadsMap.get(key)!;
          existing.temperatura = classification.temperatura;
          existing.icp = classification.icp;
        }
      }

      const leadIds = Array.from(leadsMap.keys());
      if (leadIds.length === 0) return [];

      // Buscar contatos
      const leadIdList = Array.from(leadsMap.values()).map(l => l.lead_id);
      const { data: contacts } = await supabase
        .from("lead_contacts")
        .select("lead_id, empresa, nome, telefone, email, telefone_e164")
        .in("lead_id", leadIdList);

      // Buscar estados de conversa
      const { data: convStates } = await supabase
        .from("lead_conversation_state")
        .select("lead_id, empresa, estado_funil, framework_ativo, perfil_disc")
        .in("lead_id", leadIdList);

      // Buscar classificações (para os que não vieram da query de quentes)
      const { data: allClassifications } = await supabase
        .from("lead_classifications")
        .select("lead_id, empresa, temperatura, icp")
        .in("lead_id", leadIdList);

      // Enriquecer dados
      const results: LeadQuente[] = [];
      for (const [key, lead] of leadsMap) {
        const contact = contacts?.find(
          c => c.lead_id === lead.lead_id && c.empresa === lead.empresa
        );
        const convState = convStates?.find(
          c => c.lead_id === lead.lead_id && c.empresa === lead.empresa
        );
        const classification = allClassifications?.find(
          c => c.lead_id === lead.lead_id && c.empresa === lead.empresa
        );

        results.push({
          id: lead.id!,
          lead_id: lead.lead_id!,
          empresa: lead.empresa!,
          motivo: lead.motivo!,
          created_at: lead.created_at!,
          nome: contact?.nome || null,
          telefone: contact?.telefone_e164 || contact?.telefone || null,
          email: contact?.email || null,
          temperatura: (lead.temperatura || classification?.temperatura) as LeadQuente["temperatura"],
          icp: lead.icp || classification?.icp || null,
          estado_funil: convState?.estado_funil || null,
          framework_ativo: convState?.framework_ativo || null,
          perfil_disc: convState?.perfil_disc || null,
          intent: lead.intent,
          intent_summary: lead.intent_summary,
          acao_recomendada: lead.acao_recomendada,
        });
      }

      // Ordenar por data
      results.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return results;
    },
    refetchInterval: 60000, // Atualizar a cada minuto
  });
}
