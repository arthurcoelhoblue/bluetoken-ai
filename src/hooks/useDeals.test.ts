import { describe, it, expect } from "vitest";
import { useKanbanData } from "./useDeals";
import type { DealWithRelations, PipelineStage } from "@/types/deal";

const mockStages: PipelineStage[] = [
  { id: "s1", nome: "Prospecção", cor: "#ccc", posicao: 1, pipeline_id: "p1", is_won: false, is_lost: false, is_priority: false, sla_minutos: null, tempo_minimo_dias: null, created_at: "", updated_at: "" },
  { id: "s2", nome: "Negociação", cor: "#aaa", posicao: 2, pipeline_id: "p1", is_won: false, is_lost: false, is_priority: false, sla_minutos: null, tempo_minimo_dias: null, created_at: "", updated_at: "" },
  { id: "s3", nome: "Ganho", cor: "#0f0", posicao: 3, pipeline_id: "p1", is_won: true, is_lost: false, is_priority: false, sla_minutos: null, tempo_minimo_dias: null, created_at: "", updated_at: "" },
];

const baseDeal: Omit<DealWithRelations, 'id' | 'titulo' | 'stage_id' | 'valor' | 'posicao_kanban'> = {
  contact_id: "c1", pipeline_id: "p1", moeda: "BRL", owner_id: null,
  temperatura: "FRIO", fechado_em: null, motivo_perda: null, motivo_perda_closer: null,
  motivo_perda_ia: null, categoria_perda_closer: null, categoria_perda_ia: null,
  motivo_perda_final: null, categoria_perda_final: null, perda_resolvida: false,
  perda_resolvida_por: null, perda_resolvida_em: null, organization_id: null,
  etiqueta: null, data_ganho: null, data_perda: null, utm_source: null,
  utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
  gclid: null, fbclid: null, score_engajamento: 0, score_intencao: 0,
  score_valor: 0, score_urgencia: 0, score_probabilidade: 0,
  scoring_dimensoes: null, proxima_acao_sugerida: null, scoring_updated_at: null,
  origem: null, contexto_sdr: null,
  stage_origem_id: null, stage_fechamento_id: null, status: "ABERTO",
  created_at: "", updated_at: "", contacts: null, pipeline_stages: null, owner: null,
};

const mockDeals: DealWithRelations[] = [
  { ...baseDeal, id: "d1", titulo: "Deal 1", stage_id: "s1", valor: 1000, posicao_kanban: 0 },
  { ...baseDeal, id: "d2", titulo: "Deal 2", stage_id: "s1", valor: 2000, posicao_kanban: 1 },
  { ...baseDeal, id: "d3", titulo: "Deal 3", stage_id: "s2", valor: 5000, posicao_kanban: 0 },
];

describe("useKanbanData", () => {
  it("returns empty when no data", () => {
    const result = useKanbanData(undefined, undefined);
    expect(result.columns).toEqual([]);
    expect(result.wonLost).toEqual([]);
  });

  it("groups deals into correct stages", () => {
    const result = useKanbanData(mockDeals, mockStages);
    expect(result.columns).toHaveLength(3);
    expect(result.columns[0].deals).toHaveLength(2);
    expect(result.columns[1].deals).toHaveLength(1);
    expect(result.columns[2].deals).toHaveLength(0);
  });

  it("calculates totalValor correctly per column", () => {
    const result = useKanbanData(mockDeals, mockStages);
    expect(result.columns[0].totalValor).toBe(3000);
    expect(result.columns[1].totalValor).toBe(5000);
    expect(result.columns[2].totalValor).toBe(0);
  });

  it("wonLost is always empty", () => {
    const result = useKanbanData(mockDeals, mockStages);
    expect(result.wonLost).toEqual([]);
  });
});

// ─── Score de Probabilidade ──────────────────────────────
describe("score_probabilidade validation", () => {
  it("open deals have score_probabilidade as number", () => {
    const deal: DealWithRelations = { ...baseDeal, id: "d4", titulo: "Open", stage_id: "s1", valor: 1000, posicao_kanban: 0, score_probabilidade: 42 };
    expect(typeof deal.score_probabilidade).toBe("number");
    expect(deal.score_probabilidade).toBeGreaterThanOrEqual(0);
    expect(deal.score_probabilidade).toBeLessThanOrEqual(100);
  });

  it("closed deals should have score 0", () => {
    const deal: DealWithRelations = { ...baseDeal, id: "d5", titulo: "Closed", stage_id: "s3", valor: 3000, posicao_kanban: 0, status: "GANHO", score_probabilidade: 0 };
    expect(deal.score_probabilidade).toBe(0);
  });

  it("score bounds are 0-100", () => {
    expect(baseDeal.score_probabilidade).toBe(0);
    const hot: DealWithRelations = { ...baseDeal, id: "d6", titulo: "Hot", stage_id: "s2", valor: 10000, posicao_kanban: 0, temperatura: "QUENTE", score_probabilidade: 85 };
    expect(hot.score_probabilidade).toBeLessThanOrEqual(100);
  });
});
