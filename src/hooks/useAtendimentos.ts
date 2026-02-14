import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Atendimento {
  lead_id: string;
  empresa: 'TOKENIZA' | 'BLUE';
  nome: string | null;
  telefone: string | null;
  telefone_e164: string | null;
  ultima_mensagem: string | null;
  ultimo_contato: string | null;
  ultima_direcao: string | null;
  total_inbound: number;
  total_outbound: number;
  estado_funil: string | null;
  framework_ativo: string | null;
  perfil_disc: string | null;
  ultimo_intent: string | null;
}

interface UseAtendimentosOptions {
  empresaFilter?: 'TOKENIZA' | 'BLUE' | null;
}

export function useAtendimentos({ empresaFilter }: UseAtendimentosOptions = {}) {
  return useQuery({
    queryKey: ['atendimentos', empresaFilter],
    queryFn: async (): Promise<Atendimento[]> => {
      // 1. Find leads with passive-mode messages (run_id IS NULL = Blue Chat / passive)
      // Use lead_messages directly instead of lead_message_intents to catch ALL passive conversations
      // (some leads may have messages but no intents if sdr-ia-interpret failed)
      let passiveQuery = supabase
        .from('lead_messages')
        .select('lead_id, empresa')
        .is('run_id', null)
        .not('lead_id', 'is', null);

      if (empresaFilter) {
        passiveQuery = passiveQuery.eq('empresa', empresaFilter);
      }

      const { data: passiveMessages, error: passiveErr } = await passiveQuery;
      if (passiveErr) throw passiveErr;
      if (!passiveMessages || passiveMessages.length === 0) return [];

      // Deduplicate lead_id + empresa pairs
      const uniqueKeys = new Set<string>();
      const leadIds: string[] = [];
      for (const pm of passiveMessages) {
        if (!pm.lead_id) continue;
        const key = `${pm.lead_id}_${pm.empresa}`;
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          leadIds.push(pm.lead_id);
        }
      }
      if (leadIds.length === 0) return [];

      // 2. Fetch contact info for these leads
      let contactsQuery = supabase
        .from('lead_contacts')
        .select('lead_id, empresa, nome, telefone, telefone_e164')
        .in('lead_id', leadIds);
      if (empresaFilter) {
        contactsQuery = contactsQuery.eq('empresa', empresaFilter);
      }
      const { data: contacts, error: contactsError } = await contactsQuery;
      if (contactsError) throw contactsError;

      // 2. Fetch latest messages, conversation states, and intents in parallel
      const [messagesRes, statesRes, intentsRes] = await Promise.all([
        supabase
          .from('lead_messages')
          .select('lead_id, conteudo, created_at, direcao')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('lead_conversation_state')
          .select('lead_id, empresa, estado_funil, framework_ativo, perfil_disc')
          .in('lead_id', leadIds),
        supabase
          .from('lead_message_intents')
          .select('lead_id, intent, created_at')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false }),
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (statesRes.error) throw statesRes.error;
      if (intentsRes.error) throw intentsRes.error;

      // Build maps
      const messagesByLead = new Map<string, { conteudo: string; created_at: string; direcao: string; inbound: number; outbound: number }>();
      for (const msg of messagesRes.data || []) {
        if (!msg.lead_id) continue;
        const existing = messagesByLead.get(msg.lead_id);
        if (!existing) {
          messagesByLead.set(msg.lead_id, {
            conteudo: msg.conteudo,
            created_at: msg.created_at,
            direcao: msg.direcao,
            inbound: msg.direcao === 'INBOUND' ? 1 : 0,
            outbound: msg.direcao === 'OUTBOUND' ? 1 : 0,
          });
        } else {
          if (msg.direcao === 'INBOUND') existing.inbound++;
          else if (msg.direcao === 'OUTBOUND') existing.outbound++;
        }
      }

      const statesByLead = new Map<string, { estado_funil: string; framework_ativo: string; perfil_disc: string | null }>();
      for (const s of statesRes.data || []) {
        const key = `${s.lead_id}_${s.empresa}`;
        if (!statesByLead.has(key)) {
          statesByLead.set(key, { estado_funil: s.estado_funil, framework_ativo: s.framework_ativo, perfil_disc: s.perfil_disc });
        }
      }

      const intentsByLead = new Map<string, string>();
      for (const i of intentsRes.data || []) {
        if (i.lead_id && !intentsByLead.has(i.lead_id)) {
          intentsByLead.set(i.lead_id, i.intent);
        }
      }

      // 3. Merge
      const atendimentos: Atendimento[] = contacts.map(c => {
        const msgs = messagesByLead.get(c.lead_id);
        const state = statesByLead.get(`${c.lead_id}_${c.empresa}`);
        const intent = intentsByLead.get(c.lead_id);

        return {
          lead_id: c.lead_id,
          empresa: c.empresa as 'TOKENIZA' | 'BLUE',
          nome: c.nome,
          telefone: c.telefone,
          telefone_e164: c.telefone_e164,
          ultima_mensagem: msgs?.conteudo ?? null,
          ultimo_contato: msgs?.created_at ?? null,
          ultima_direcao: msgs?.direcao ?? null,
          total_inbound: msgs?.inbound ?? 0,
          total_outbound: msgs?.outbound ?? 0,
          estado_funil: state?.estado_funil ?? null,
          framework_ativo: state?.framework_ativo ?? null,
          perfil_disc: state?.perfil_disc ?? null,
          ultimo_intent: intent ?? null,
        };
      });

      // Sort by most recent contact
      atendimentos.sort((a, b) => {
        if (!a.ultimo_contato && !b.ultimo_contato) return 0;
        if (!a.ultimo_contato) return 1;
        if (!b.ultimo_contato) return -1;
        return new Date(b.ultimo_contato).getTime() - new Date(a.ultimo_contato).getTime();
      });

      return atendimentos;
    },
    refetchInterval: 60000, // Auto-refresh every 60s (reduced from 30s for cost optimization)
    refetchOnWindowFocus: true,
  });
}
