import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: wonDeals } = await supabase.from('deals').select(`id, valor, titulo, canal_origem, temperatura, contact_id, contacts!inner(linkedin_cargo, linkedin_empresa, linkedin_setor, canal_origem, tags, tipo, organization_id, organizations(nome, setor, porte))`).eq('status', 'GANHO').order('fechado_em', { ascending: false }).limit(200);
    const { data: lostDeals } = await supabase.from('deals').select(`id, valor, titulo, canal_origem, temperatura, motivo_perda, contact_id, contacts!inner(linkedin_cargo, linkedin_empresa, linkedin_setor, canal_origem, tags, tipo, organization_id, organizations(nome, setor, porte))`).eq('status', 'PERDIDO').order('fechado_em', { ascending: false }).limit(200);

    const won = wonDeals || [];
    const lost = lostDeals || [];
    const patterns = analyzePatterns(won);
    const patternsLost = analyzePatterns(lost);
    const analysisData = { won: patterns, lost: patternsLost, total_won: won.length, total_lost: lost.length, win_rate: won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0 };

    let icpNarrative = '';
    if ((won.length + lost.length) >= 10) {
      const prompt = `Analise padrões de deals ganhos vs perdidos e gere ICP em português:\n\nGANHOS (${won.length}):\n- Setores: ${JSON.stringify(analysisData.won.topSectors)}\n- Cargos: ${JSON.stringify(analysisData.won.topRoles)}\n- Canais: ${JSON.stringify(analysisData.won.topChannels)}\n- Ticket médio: R$ ${analysisData.won.avgValue.toFixed(0)}\n\nPERDIDOS (${lost.length}):\n- Setores: ${JSON.stringify(analysisData.lost.topSectors)}\n- Motivos: ${JSON.stringify(analysisData.lost.topLossReasons)}\n- Ticket médio: R$ ${analysisData.lost.avgValue.toFixed(0)}\n\nJSON: {"icp_summary":"3 frases","ideal_sectors":[...],"ideal_roles":[...],"ideal_channels":[...],"red_flags":[...],"recommendations":[...]}`;

      const aiResult = await callAI({
        system: 'Você é um analista de ICP. Retorne APENAS JSON válido sem markdown.',
        prompt,
        functionName: 'icp-learner',
        maxTokens: 1000,
        supabase,
      });
      icpNarrative = aiResult.content;
    }

    if (icpNarrative || won.length > 0) {
      await supabase.from('system_settings').upsert({ category: 'ia', key: 'icp_profile', value: { patterns: analysisData, narrative: icpNarrative, generated_at: new Date().toISOString() } }, { onConflict: 'category,key' });
    }

    return new Response(JSON.stringify({ success: true, patterns: analysisData, icpNarrative: icpNarrative.slice(0, 500) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('ICP learner error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function analyzePatterns(deals: any[]) {
  const sectors: Record<string, number> = {};
  const roles: Record<string, number> = {};
  const channels: Record<string, number> = {};
  const sizes: Record<string, number> = {};
  const lossReasons: Record<string, number> = {};
  let totalValue = 0;
  for (const d of deals) {
    totalValue += d.valor || 0;
    const contact = Array.isArray(d.contacts) ? d.contacts[0] : d.contacts;
    if (contact?.linkedin_setor) sectors[contact.linkedin_setor] = (sectors[contact.linkedin_setor] || 0) + 1;
    if (contact?.linkedin_cargo) roles[contact.linkedin_cargo] = (roles[contact.linkedin_cargo] || 0) + 1;
    if (d.canal_origem) channels[d.canal_origem] = (channels[d.canal_origem] || 0) + 1;
    const org = contact?.organizations;
    if (org?.porte) sizes[org.porte] = (sizes[org.porte] || 0) + 1;
    if (d.motivo_perda) lossReasons[d.motivo_perda] = (lossReasons[d.motivo_perda] || 0) + 1;
  }
  const topN = (obj: Record<string, number>, n = 5) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, count: v }));
  return { topSectors: topN(sectors), topRoles: topN(roles), topChannels: topN(channels), topSizes: topN(sizes), topLossReasons: topN(lossReasons), avgValue: deals.length > 0 ? totalValue / deals.length : 0 };
}
