import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import type { ActiveCompany } from '@/contexts/CompanyContext';

export interface Atendimento {
  lead_id: string;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
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
  empresaFilter?: ActiveCompany[];
  userId?: string;
  isAdmin?: boolean;
}

/**
 * NOTA TÉCNICA: Paginação client-side é intencional aqui.
 * Este hook faz merge complexo de 4 tabelas (lead_messages, lead_contacts,
 * lead_conversation_state, lead_message_intents) no client, o que impede
 * o uso de .range() server-side. A alternativa seria criar uma view materializada.
 */
export function useAtendimentos({ empresaFilter, userId, isAdmin }: UseAtendimentosOptions = {}) {
  return useQuery({
    queryKey: ['atendimentos', empresaFilter, userId, isAdmin],
    queryFn: async (): Promise<Atendimento[]> => {
      // 1. Find leads with passive-mode messages (run_id IS NULL = passive)
      let passiveQuery = supabase
        .from('lead_messages')
        .select('lead_id, empresa')
        .is('run_id', null)
        .not('lead_id', 'is', null);

      if (empresaFilter?.length) {
        passiveQuery = passiveQuery.in('empresa', empresaFilter);
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
      if (empresaFilter?.length) {
        contactsQuery = contactsQuery.in('empresa', empresaFilter);
      }
      const { data: contacts, error: contactsError } = await contactsQuery;
      if (contactsError) throw contactsError;

      // 3. Fetch messages, conversation states, intents, AND ownership data in parallel
      const contactLeadIds = contacts?.map(c => c.lead_id).filter(Boolean) ?? leadIds;

      const [messagesRes, statesRes, intentsRes, crmContactsRes] = await Promise.all([
        supabase
          .from('lead_messages')
          .select('lead_id, conteudo, created_at, direcao')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('lead_conversation_state')
          .select('lead_id, empresa, estado_funil, framework_ativo, perfil_disc, assumido_por')
          .in('lead_id', leadIds),
        supabase
          .from('lead_message_intents')
          .select('lead_id, intent, created_at')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('contacts')
          .select('id, legacy_lead_id, empresa')
          .in('legacy_lead_id', contactLeadIds),
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (statesRes.error) throw statesRes.error;
      if (intentsRes.error) throw intentsRes.error;
      if (crmContactsRes.error) throw crmContactsRes.error;

      // 4. Fetch deals for ownership + open status filtering
      const crmContacts = crmContactsRes.data ?? [];
      const contactIdToLeadId = new Map<string, string>();
      const crmContactIds: string[] = [];
      for (const cc of crmContacts) {
        if (cc.id && cc.legacy_lead_id) {
          contactIdToLeadId.set(cc.id, cc.legacy_lead_id);
          crmContactIds.push(cc.id);
        }
      }

      // Map lead_id -> deal ownership info
      const leadDealInfo = new Map<string, { hasOpenDeal: boolean; ownerIds: string[] }>();

      if (crmContactIds.length > 0) {
        const { data: deals, error: dealsErr } = await supabase
          .from('deals')
          .select('id, contact_id, owner_id, status')
          .in('contact_id', crmContactIds);

        if (dealsErr) throw dealsErr;

        for (const deal of deals ?? []) {
          const leadId = contactIdToLeadId.get(deal.contact_id);
          if (!leadId) continue;
          const existing = leadDealInfo.get(leadId) ?? { hasOpenDeal: false, ownerIds: [] };
          if (deal.status === 'ABERTO') {
            existing.hasOpenDeal = true;
            if (deal.owner_id) existing.ownerIds.push(deal.owner_id);
          }
          leadDealInfo.set(leadId, existing);
        }
      }

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

      const statesByLead = new Map<string, { estado_funil: string; framework_ativo: string; perfil_disc: string | null; assumido_por: string | null }>();
      for (const s of statesRes.data || []) {
        const key = `${s.lead_id}_${s.empresa}`;
        if (!statesByLead.has(key)) {
          statesByLead.set(key, { estado_funil: s.estado_funil, framework_ativo: s.framework_ativo, perfil_disc: s.perfil_disc, assumido_por: s.assumido_por });
        }
      }

      const intentsByLead = new Map<string, string>();
      for (const i of intentsRes.data || []) {
        if (i.lead_id && !intentsByLead.has(i.lead_id)) {
          intentsByLead.set(i.lead_id, i.intent);
        }
      }

      // Deduplicar contacts por lead_id
      const contactsByLeadId = new Map<string, typeof contacts[0][]>();
      for (const c of contacts!) {
        const existing = contactsByLeadId.get(c.lead_id) || [];
        existing.push(c);
        contactsByLeadId.set(c.lead_id, existing);
      }

      const deduplicatedContacts: typeof contacts = [];
      for (const [, dupes] of contactsByLeadId) {
        if (dupes.length === 1) {
          deduplicatedContacts.push(dupes[0]);
        } else {
          const withMessages = dupes.find(d => uniqueKeys.has(`${d.lead_id}_${d.empresa}`));
          deduplicatedContacts.push(withMessages || dupes[0]);
        }
      }

      // 5. Merge + filter by ownership
      const atendimentos: Atendimento[] = [];
      for (const c of deduplicatedContacts) {
        const msgs = messagesByLead.get(c.lead_id);
        const state = statesByLead.get(`${c.lead_id}_${c.empresa}`);
        const intent = intentsByLead.get(c.lead_id);
        const dealInfo = leadDealInfo.get(c.lead_id);

        // Filter: only show conversations with open deals OR no deal at all (new leads)
        // For admins: show all (open deals + no deal)
        // For non-admins: only show if they own the deal OR assumed the conversation
        if (dealInfo && !dealInfo.hasOpenDeal) {
          // Has deals but none open → conversation is "closed"
          continue;
        }

        if (!isAdmin && userId) {
          const ownsOpenDeal = dealInfo?.ownerIds.includes(userId) ?? false;
          const assumedConversation = state?.assumido_por === userId;
          const noDealYet = !dealInfo; // New lead without deal — show to all sellers

          if (!ownsOpenDeal && !assumedConversation && !noDealYet) {
            continue;
          }
        }

        atendimentos.push({
          lead_id: c.lead_id,
          empresa: c.empresa as 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
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
        });
      }

      // Sort by most recent contact
      atendimentos.sort((a, b) => {
        if (!a.ultimo_contato && !b.ultimo_contato) return 0;
        if (!a.ultimo_contato) return 1;
        if (!b.ultimo_contato) return -1;
        return new Date(b.ultimo_contato).getTime() - new Date(a.ultimo_contato).getTime();
      });

      return atendimentos;
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
}
