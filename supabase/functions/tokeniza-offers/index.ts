import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenizaOffer {
  id: string;
  name: string;
  img: string;
  type: string;
  user_responsible: string | null;
  deadline: string;
  startDate: string;
  finalDate: string;
  targetCapture: string;
  minimumCapture: string;
  translatable: string | null;
  moneyReceived: number;
  duration_days: string;
  profitability: string;
  typeOfRisk: string;
  acceptedCurrency: string;
  status: string;
  company: string;
  companyWebsite: string;
  contract: string;
  minimumContribution: string;
  documents: Array<{ url: string; name: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const status = url.searchParams.get('status'); // 'open', 'finished', etc.
    const offerId = url.searchParams.get('id');

    console.log('[tokeniza-offers] Fetching offers from Tokeniza API...');

    // Fetch from Tokeniza API
    const apiUrl = 'https://plataforma.tokeniza.com.br/api/v1/crowdfunding/getCrowdfundingList';
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[tokeniza-offers] API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch offers from Tokeniza' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const offers: TokenizaOffer[] = await response.json();
    console.log(`[tokeniza-offers] Received ${offers.length} offers`);

    // Filter by status if provided
    let filteredOffers = offers;
    if (status) {
      filteredOffers = offers.filter(o => o.status.toLowerCase() === status.toLowerCase());
    }

    // Return single offer if ID provided
    if (offerId) {
      const offer = offers.find(o => o.id === offerId);
      if (!offer) {
        return new Response(
          JSON.stringify({ error: 'Offer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify(offer),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform for easier consumption
    const transformedOffers = filteredOffers.map(offer => ({
      id: offer.id,
      nome: offer.name,
      imagem: offer.img,
      tipo: offer.type,
      status: offer.status,
      empresa: offer.company,
      empresaWebsite: offer.companyWebsite,
      rentabilidade: offer.profitability,
      duracaoDias: parseInt(offer.duration_days) || 0,
      contribuicaoMinima: parseInt(offer.minimumContribution) || 0,
      metaCaptacao: parseInt(offer.targetCapture) || 0,
      captacaoMinima: parseInt(offer.minimumCapture) || 0,
      valorCaptado: offer.moneyReceived,
      percentualCaptado: offer.targetCapture ? 
        Math.round((offer.moneyReceived / parseInt(offer.targetCapture)) * 100) : 0,
      tipoRisco: offer.typeOfRisk,
      moeda: offer.acceptedCurrency,
      dataInicio: offer.startDate,
      dataFim: offer.finalDate,
      diasRestantes: parseInt(offer.deadline) || 0,
      documentos: offer.documents,
    }));

    // Summary for open offers
    const openOffers = transformedOffers.filter(o => o.status === 'open');
    const summary = {
      totalOfertas: transformedOffers.length,
      ofertasAbertas: openOffers.length,
      maiorRentabilidade: openOffers.length > 0 
        ? Math.max(...openOffers.map(o => parseInt(o.rentabilidade) || 0))
        : 0,
      menorContribuicao: openOffers.length > 0
        ? Math.min(...openOffers.map(o => o.contribuicaoMinima))
        : 0,
    };

    return new Response(
      JSON.stringify({ 
        ofertas: transformedOffers,
        resumo: summary,
        atualizadoEm: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[tokeniza-offers] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
