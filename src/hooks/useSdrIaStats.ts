import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { startOfDay, subDays, format } from 'date-fns';

export interface SdrIaStats {
  // Totais gerais
  totalInterpretacoes: number;
  interpretacoesHoje: number;
  interpretacoesSemana: number;
  
  // Por intent
  intentBreakdown: { intent: string; count: number }[];
  
  // Por ação
  acaoBreakdown: { acao: string; count: number; aplicada: number }[];
  
  // Métricas de cadência
  cadenciasAtivas: number;
  cadenciasPausadas: number;
  cadenciasConcluidas: number;
  cadenciasCanceladas: number;
  
  // Mensagens
  mensagensEnviadas: number;
  mensagensEntregues: number;
  mensagensLidas: number;
  mensagensErro: number;
  
  // Série temporal (últimos 7 dias)
  interpretacoesPorDia: { date: string; count: number }[];
  mensagensPorDia: { date: string; enviadas: number; entregues: number }[];
  
  // Performance
  tempoMedioProcessamento: number;
  confiancaMedia: number;
}

export function useSdrIaStats() {
  const { activeCompany } = useCompany();
  return useQuery({
    queryKey: ['sdr-ia-stats', activeCompany],
    queryFn: async (): Promise<SdrIaStats> => {
      const now = new Date();
      const today = startOfDay(now);
      const weekAgo = subDays(today, 7);
      
      // Fetch all data in parallel
      const [
        interpretacoesResult,
        cadenciasResult,
        mensagensResult,
      ] = await Promise.all([
        // Interpretações
        supabase
          .from('lead_message_intents')
          .select('intent, acao_recomendada, acao_aplicada, created_at, tempo_processamento_ms, intent_confidence')
          .eq('empresa', activeCompany)
          .gte('created_at', weekAgo.toISOString()),
        
        // Cadências
        supabase
          .from('lead_cadence_runs')
          .select('status, created_at')
          .eq('empresa', activeCompany),
        
        // Mensagens
        supabase
          .from('lead_messages')
          .select('estado, enviado_em, entregue_em, lido_em, created_at, direcao')
          .eq('empresa', activeCompany)
          .eq('direcao', 'SAIDA')
          .gte('created_at', weekAgo.toISOString()),
      ]);
      
      const interpretacoes = interpretacoesResult.data || [];
      const cadencias = cadenciasResult.data || [];
      const mensagens = mensagensResult.data || [];
      
      // Calcular métricas de interpretação
      const interpretacoesHoje = interpretacoes.filter(
        i => new Date(i.created_at) >= today
      ).length;
      
      // Intent breakdown
      const intentCounts: Record<string, number> = {};
      interpretacoes.forEach(i => {
        intentCounts[i.intent] = (intentCounts[i.intent] || 0) + 1;
      });
      const intentBreakdown = Object.entries(intentCounts)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count);
      
      // Ação breakdown
      const acaoCounts: Record<string, { count: number; aplicada: number }> = {};
      interpretacoes.forEach(i => {
        if (!acaoCounts[i.acao_recomendada]) {
          acaoCounts[i.acao_recomendada] = { count: 0, aplicada: 0 };
        }
        acaoCounts[i.acao_recomendada].count++;
        if (i.acao_aplicada) {
          acaoCounts[i.acao_recomendada].aplicada++;
        }
      });
      const acaoBreakdown = Object.entries(acaoCounts)
        .map(([acao, data]) => ({ acao, ...data }))
        .sort((a, b) => b.count - a.count);
      
      // Cadências por status
      const statusCounts = {
        ATIVA: 0,
        PAUSADA: 0,
        CONCLUIDA: 0,
        CANCELADA: 0,
      };
      cadencias.forEach(c => {
        if (c.status in statusCounts) {
          statusCounts[c.status as keyof typeof statusCounts]++;
        }
      });
      
      // Mensagens
      const mensagensEnviadas = mensagens.filter(m => m.enviado_em).length;
      const mensagensEntregues = mensagens.filter(m => m.entregue_em).length;
      const mensagensLidas = mensagens.filter(m => m.lido_em).length;
      const mensagensErro = mensagens.filter(m => m.estado === 'ERRO').length;
      
      // Série temporal - interpretações por dia
      const interpretacoesPorDia: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), 'yyyy-MM-dd');
        interpretacoesPorDia[date] = 0;
      }
      interpretacoes.forEach(i => {
        const date = format(new Date(i.created_at), 'yyyy-MM-dd');
        if (date in interpretacoesPorDia) {
          interpretacoesPorDia[date]++;
        }
      });
      
      // Série temporal - mensagens por dia
      const mensagensPorDia: Record<string, { enviadas: number; entregues: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), 'yyyy-MM-dd');
        mensagensPorDia[date] = { enviadas: 0, entregues: 0 };
      }
      mensagens.forEach(m => {
        const date = format(new Date(m.created_at), 'yyyy-MM-dd');
        if (date in mensagensPorDia) {
          if (m.enviado_em) mensagensPorDia[date].enviadas++;
          if (m.entregue_em) mensagensPorDia[date].entregues++;
        }
      });
      
      // Performance
      const temposProcessamento = interpretacoes
        .filter(i => i.tempo_processamento_ms)
        .map(i => i.tempo_processamento_ms!);
      const tempoMedioProcessamento = temposProcessamento.length > 0
        ? Math.round(temposProcessamento.reduce((a, b) => a + b, 0) / temposProcessamento.length)
        : 0;
      
      const confiancas = interpretacoes.map(i => Number(i.intent_confidence));
      const confiancaMedia = confiancas.length > 0
        ? Math.round((confiancas.reduce((a, b) => a + b, 0) / confiancas.length) * 100)
        : 0;
      
      return {
        totalInterpretacoes: interpretacoes.length,
        interpretacoesHoje,
        interpretacoesSemana: interpretacoes.length,
        intentBreakdown,
        acaoBreakdown,
        cadenciasAtivas: statusCounts.ATIVA,
        cadenciasPausadas: statusCounts.PAUSADA,
        cadenciasConcluidas: statusCounts.CONCLUIDA,
        cadenciasCanceladas: statusCounts.CANCELADA,
        mensagensEnviadas,
        mensagensEntregues,
        mensagensLidas,
        mensagensErro,
        interpretacoesPorDia: Object.entries(interpretacoesPorDia).map(([date, count]) => ({ date, count })),
        mensagensPorDia: Object.entries(mensagensPorDia).map(([date, data]) => ({ date, ...data })),
        tempoMedioProcessamento,
        confiancaMedia,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
