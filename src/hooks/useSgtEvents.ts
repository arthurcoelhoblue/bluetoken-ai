import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SGTEvent = Database['public']['Tables']['sgt_events']['Row'];
type SGTEventLog = Database['public']['Tables']['sgt_event_logs']['Row'];

export type SGTEventWithLogs = SGTEvent & {
  sgt_event_logs: SGTEventLog[];
};

export interface SGTEventsFilters {
  empresa?: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA' | null;
  evento?: Database['public']['Enums']['sgt_evento_tipo'] | null;
  status?: Database['public']['Enums']['sgt_event_status'] | null;
  dataInicial?: Date | null;
  dataFinal?: Date | null;
}

export interface UseSgtEventsOptions {
  filters?: SGTEventsFilters;
  page?: number;
  pageSize?: number;
}

export function useSgtEvents(options: UseSgtEventsOptions = {}) {
  const { filters = {}, page = 1, pageSize = 20 } = options;

  return useQuery({
    queryKey: ['sgt-events', filters, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('sgt_events')
        .select(`
          *,
          sgt_event_logs (*)
        `, { count: 'exact' })
        .order('recebido_em', { ascending: false })
        .range(from, to);

      // Apply filters
      if (filters.empresa) {
        query = query.eq('empresa', filters.empresa);
      }

      if (filters.evento) {
        query = query.eq('evento', filters.evento);
      }

      if (filters.dataInicial) {
        query = query.gte('recebido_em', filters.dataInicial.toISOString());
      }

      if (filters.dataFinal) {
        // Add 1 day to include the entire end date
        const endDate = new Date(filters.dataFinal);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('recebido_em', endDate.toISOString());
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      // Filter by status (done client-side since it's in the logs table)
      let filteredData = data as SGTEventWithLogs[];
      
      if (filters.status) {
        filteredData = filteredData.filter(event => {
          const latestLog = event.sgt_event_logs
            ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          return latestLog?.status === filters.status;
        });
      }

      return {
        events: filteredData,
        totalCount: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      };
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useSgtEventDetails(eventId: string | null) {
  return useQuery({
    queryKey: ['sgt-event-details', eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const { data: event, error: eventError } = await supabase
        .from('sgt_events')
        .select(`
          *,
          sgt_event_logs (*)
        `)
        .eq('id', eventId)
        .single();

      if (eventError) {
        throw eventError;
      }

      // Fetch related lead_contacts
      const { data: leadContact } = await supabase
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', event.lead_id)
        .eq('empresa', event.empresa)
        .maybeSingle();

      // Fetch related classification
      const { data: classification } = await supabase
        .from('lead_classifications')
        .select('*')
        .eq('lead_id', event.lead_id)
        .eq('empresa', event.empresa)
        .order('classificado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch related cadence run
      const { data: cadenceRun } = await supabase
        .from('lead_cadence_runs')
        .select(`
          *,
          cadences (nome, codigo)
        `)
        .eq('lead_id', event.lead_id)
        .eq('empresa', event.empresa)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        event: event as SGTEventWithLogs,
        leadContact,
        classification,
        cadenceRun,
      };
    },
    enabled: !!eventId,
  });
}
