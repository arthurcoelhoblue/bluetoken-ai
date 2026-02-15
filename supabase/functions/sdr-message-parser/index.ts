import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SDR Message Parser — normalizes message, detects urgency, loads context
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const URGENCIA_PATTERNS: Record<string, string[]> = {
  DECISAO_TOMADA: ['quero contratar', 'quero fechar', 'como pago', 'manda o pix', 'vamos fechar', 'fechado', 'aceito', 'to dentro', 'próximo passo', 'onde pago', 'pode cobrar', 'o que preciso enviar', 'quais documentos', 'como começo'],
  URGENCIA_TEMPORAL: ['urgente', 'preciso urgente', 'prazo', 'até amanhã', 'essa semana', 'malha fina', 'multa', 'declaração', 'estou atrasado', 'correndo contra o tempo'],
  FRUSTRADO_ALTERNATIVA: ['já tentei', 'não funcionou', 'gastei dinheiro', 'contador não resolve', 'cansei', 'péssima experiência'],
  PEDIDO_REUNIAO_DIRETO: ['quero uma reunião', 'marcar reunião', 'me liga', 'pode me ligar', 'vamos conversar'],
  PEDIDO_HUMANO: ['falar com humano', 'falar com alguém', 'atendente', 'atendimento humano', 'vocês são robô', 'quero falar com gente'],
};

function detectUrgency(msg: string) {
  const msgNorm = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const priority = ['PEDIDO_HUMANO', 'DECISAO_TOMADA', 'URGENCIA_TEMPORAL', 'FRUSTRADO_ALTERNATIVA', 'PEDIDO_REUNIAO_DIRETO'];
  for (const tipo of priority) {
    for (const pattern of URGENCIA_PATTERNS[tipo]) {
      if (msgNorm.includes(pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        return { detectado: true, tipo, frase_gatilho: pattern, confianca: ['quero contratar', 'como pago', 'falar com humano', 'preciso urgente'].some(p => msgNorm.includes(p)) ? 'ALTA' : 'MEDIA' };
      }
    }
  }
  return { detectado: false, tipo: 'NENHUM', frase_gatilho: null, confianca: 'BAIXA' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const { lead_id, empresa, mensagem, canal } = body;

    if (!lead_id || !empresa || !mensagem) {
      return new Response(JSON.stringify({ error: 'lead_id, empresa, mensagem obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Detect urgency
    const urgencia = detectUrgency(mensagem);

    // Load context in parallel
    const [classRes, stateRes, msgsRes, dealsRes, contactRes] = await Promise.all([
      supabase.from('lead_classifications').select('*').eq('lead_id', lead_id).eq('empresa', empresa).order('classificado_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('lead_conversation_state').select('*').eq('lead_id', lead_id).eq('empresa', empresa).maybeSingle(),
      supabase.from('lead_messages').select('direcao, conteudo, canal, sender_type, created_at').eq('lead_id', lead_id).eq('empresa', empresa).order('created_at', { ascending: false }).limit(20),
      supabase.from('deals').select('id, titulo, valor, status, stage_id').eq('lead_id', lead_id).eq('pipeline_empresa', empresa).limit(5),
      supabase.from('lead_contacts').select('nome, primeiro_nome, email, telefone').eq('lead_id', lead_id).eq('empresa', empresa).maybeSingle(),
    ]);

    const result = {
      lead_id,
      empresa,
      canal: canal || 'WHATSAPP',
      mensagem_normalizada: mensagem.trim(),
      urgencia,
      classificacao: classRes.data || null,
      conversation_state: stateRes.data || null,
      historico: msgsRes.data || [],
      deals: dealsRes.data || [],
      contato: contactRes.data || null,
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[sdr-message-parser] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
