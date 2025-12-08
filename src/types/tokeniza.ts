export interface TokenizaOferta {
  id: string;
  nome: string;
  imagem: string;
  tipo: string;
  status: string;
  empresa: string;
  empresaWebsite: string;
  rentabilidade: string;
  duracaoDias: number;
  contribuicaoMinima: number;
  metaCaptacao: number;
  captacaoMinima: number;
  valorCaptado: number;
  percentualCaptado: number;
  tipoRisco: string;
  moeda: string;
  dataInicio: string;
  dataFim: string;
  diasRestantes: number;
  documentos: Array<{ url: string; name: string }>;
}

export interface TokenizaResumo {
  totalOfertas: number;
  ofertasAbertas: number;
  maiorRentabilidade: number;
  menorContribuicao: number;
}

export interface TokenizaOffersResponse {
  ofertas: TokenizaOferta[];
  resumo: TokenizaResumo;
  atualizadoEm: string;
}
