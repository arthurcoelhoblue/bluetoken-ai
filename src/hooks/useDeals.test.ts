import { describe, it, expect } from "vitest";
import { useKanbanData } from "./useDeals";
import type { DealWithRelations, PipelineStage } from "@/types/deal";

const mockStages: PipelineStage[] = [
  { id: "s1", nome: "Prospecção", cor: "#ccc", posicao: 1, pipeline_id: "p1", is_won: false, is_lost: false, sla_minutos: null, tempo_minimo_dias: null, created_at: "", updated_at: "" },
  { id: "s2", nome: "Negociação", cor: "#aaa", posicao: 2, pipeline_id: "p1", is_won: false, is_lost: false, sla_minutos: null, tempo_minimo_dias: null, created_at: "", updated_at: "" },
  { id: "s3", nome: "Ganho", cor: "#0f0", posicao: 3, pipeline_id: "p1", is_won: true, is_lost: false, sla_minutos: null, tempo_minimo_dias: null, created_at: "", updated_at: "" },
];

const mockDeals: DealWithRelations[] = [
  { id: "d1", titulo: "Deal 1", stage_id: "s1", pipeline_id: "p1", valor: 1000, posicao_kanban: 0, status: "ABERTO" } as any,
  { id: "d2", titulo: "Deal 2", stage_id: "s1", pipeline_id: "p1", valor: 2000, posicao_kanban: 1, status: "ABERTO" } as any,
  { id: "d3", titulo: "Deal 3", stage_id: "s2", pipeline_id: "p1", valor: 5000, posicao_kanban: 0, status: "ABERTO" } as any,
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
