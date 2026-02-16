import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, type ActiveCompany } from "@/contexts/CompanyContext";

export interface LeadQuente {
  id: string;
  lead_id: string;
  empresa: "TOKENIZA" | "BLUE";
  motivo: string;
  created_at: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  temperatura: "FRIO" | "MORNO" | "QUENTE" | null;
  icp: string | null;
  estado_funil: string | null;
  framework_ativo: string | null;
  perfil_disc: string | null;
  intent?: string;
  intent_summary?: string;
  acao_recomendada?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyEmpresaFilter<T>(query: T, activeCompany: ActiveCompany): T {
  if (activeCompany !== "ALL") {
    return (query as any).eq("empresa", activeCompany);
  }
  return query;
}

export function useLeadsQuentes() {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ["leads-quentes", activeCompany],
    queryFn: async () => {
      // Buscar intents com ações que precisam de closer
      let intentsQuery = supabase
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

      intentsQuery = applyEmpresaFilter(intentsQuery, activeCompany);
      const { data: intents, error: intentsError } = await intentsQuery;

      if (intentsError) throw intentsError;

      // Buscar classificações quentes
      let classQuery = supabase
        .from("lead_classifications")
        .select("lead_id, empresa, temperatura, icp")
        .eq("temperatura", "QUENTE")
        .order("classificado_em", { ascending: false })
        .limit(50);

      classQuery = applyEmpresaFilter(classQuery, activeCompany);
      const { data: classifications, error: classError } = await classQuery;

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
      let contactsQuery = supabase
        .from("lead_contacts")
        .select("lead_id, empresa, nome, telefone, email, telefone_e164")
        .in("lead_id", leadIdList);
      contactsQuery = applyEmpresaFilter(contactsQuery, activeCompany);
      const { data: contacts } = await contactsQuery;

      // Buscar estados de conversa
      let convQuery = supabase
        .from("lead_conversation_state")
        .select("lead_id, empresa, estado_funil, framework_ativo, perfil_disc")
        .in("lead_id", leadIdList);
      convQuery = applyEmpresaFilter(convQuery, activeCompany);
      const { data: convStates } = await convQuery;

      // Buscar classificações (para os que não vieram da query de quentes)
      let allClassQuery = supabase
        .from("lead_classifications")
        .select("lead_id, empresa, temperatura, icp")
        .in("lead_id", leadIdList);
      allClassQuery = applyEmpresaFilter(allClassQuery, activeCompany);
      const { data: allClassifications } = await allClassQuery;

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
