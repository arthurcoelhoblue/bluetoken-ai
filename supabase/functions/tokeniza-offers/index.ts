import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = getWebhookCorsHeaders();
const log = createLogger('tokeniza-offers');

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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const offerId = url.searchParams.get('id');

    log.info('Fetching offers from Tokeniza API...');

    const apiUrl = 'https://plataforma.tokeniza.com.br/api/v1/crowdfunding/getCrowdfundingList';
    const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });

    if (!response.ok) {
      log.error('API error', { status: response.status, statusText: response.statusText });
      return new Response(JSON.stringify({ error: 'Failed to fetch offers from Tokeniza' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const offers: TokenizaOffer[] = await response.json();
    log.info(`Received ${offers.length} offers`);

    let filteredOffers = offers;
    if (status) filteredOffers = offers.filter(o => o.status.toLowerCase() === status.toLowerCase());

    if (offerId) {
      const offer = offers.find(o => o.id === offerId);
      if (!offer) return new Response(JSON.stringify({ error: 'Offer not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify(offer), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const calcularDiasRestantes = (finalDate: string, offerStatus: string): number => {
      if (offerStatus.toLowerCase() === 'finished' || offerStatus.toLowerCase() === 'inactive') return 0;
      const dataFim = new Date(finalDate);
      const hoje = new Date();
      return Math.max(0, Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
    };

    const transformedOffers = filteredOffers.map(offer => ({
      id: offer.id, nome: offer.name, imagem: offer.img, tipo: offer.type, status: offer.status,
      empresa: offer.company, empresaWebsite: offer.companyWebsite, rentabilidade: offer.profitability,
      duracaoDias: parseInt(offer.duration_days) || 0, contribuicaoMinima: parseInt(offer.minimumContribution) || 0,
      metaCaptacao: parseInt(offer.targetCapture) || 0, captacaoMinima: parseInt(offer.minimumCapture) || 0,
      valorCaptado: offer.moneyReceived,
      percentualCaptado: offer.targetCapture ? Math.round((offer.moneyReceived / parseInt(offer.targetCapture)) * 100) : 0,
      tipoRisco: offer.typeOfRisk, moeda: offer.acceptedCurrency,
      dataInicio: offer.startDate, dataFim: offer.finalDate,
      diasRestantes: calcularDiasRestantes(offer.finalDate, offer.status), documentos: offer.documents,
    }));

    const activeOffers = transformedOffers.filter(o => o.status.toLowerCase() === 'active' || o.status.toLowerCase() === 'open');
    const summary = {
      totalOfertas: transformedOffers.length, ofertasAbertas: activeOffers.length,
      maiorRentabilidade: activeOffers.length > 0 ? Math.max(...activeOffers.map(o => parseInt(o.rentabilidade) || 0)) : 0,
      menorContribuicao: activeOffers.length > 0 ? Math.min(...activeOffers.filter(o => o.contribuicaoMinima > 0).map(o => o.contribuicaoMinima)) : 0,
    };

    return new Response(JSON.stringify({ ofertas: transformedOffers, resumo: summary, atualizadoEm: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
