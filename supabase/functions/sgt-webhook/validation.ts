// ========================================
// sgt-webhook/validation.ts — Validação e schemas Zod
// Extraído do index.ts (Fase D)
// ========================================

import { z } from "https://esm.sh/zod@3.25.76";
import type { SGTPayload } from "./types.ts";
import { EVENTOS_VALIDOS, EMPRESAS_VALIDAS } from "./types.ts";

export function normalizePayloadFormat(payload: Record<string, unknown>): Record<string, unknown> {
  // Se já tem dados_lead, retorna como está
  if (payload.dados_lead && typeof payload.dados_lead === 'object') {
    return payload;
  }

  // Modo flat: campos no nível raiz → converte para nested
  const flatFields = ['nome', 'email', 'telefone', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'score', 'stage', 'pipedrive_deal_id', 'url_pipedrive', 'organizacao', 'origem_tipo', 'lead_pago'];
  const hasFlatFields = flatFields.some(f => f in payload);
  
  if (hasFlatFields) {
    console.log('[SGT Webhook] Payload em formato flat detectado, convertendo...');
    const dadosLead: Record<string, unknown> = {};
    flatFields.forEach(field => {
      if (payload[field] !== undefined) {
        dadosLead[field] = payload[field];
      }
    });
    
    if (!payload.timestamp) {
      payload.timestamp = new Date().toISOString();
    }
    
    return {
      ...payload,
      dados_lead: dadosLead,
    };
  }

  return payload;
}

// ========================================
// SCHEMA ZOD
// ========================================
const sgtDadosLeadSchema = z.object({
  nome: z.string().max(200).optional(),
  email: z.string().email('email inválido').max(255),
  telefone: z.string().max(20).optional(),
  utm_source: z.string().max(500).optional(),
  utm_medium: z.string().max(500).optional(),
  utm_campaign: z.string().max(500).optional(),
  utm_term: z.string().max(500).optional(),
  utm_content: z.string().max(500).optional(),
  score: z.number().optional(),
  stage: z.string().optional(),
  pipedrive_deal_id: z.string().optional(),
  url_pipedrive: z.string().optional(),
  organizacao: z.string().max(300).optional(),
  origem_tipo: z.enum(['INBOUND', 'OUTBOUND', 'REFERRAL', 'PARTNER']).optional(),
  lead_pago: z.boolean().optional(),
  data_criacao: z.string().optional(),
  data_mql: z.string().optional(),
  data_levantou_mao: z.string().optional(),
  data_reuniao: z.string().optional(),
  data_venda: z.string().optional(),
  valor_venda: z.number().optional(),
  tipo_lead: z.enum(['INVESTIDOR', 'CAPTADOR']).optional(),
}).passthrough();

const sgtPayloadSchema = z.object({
  lead_id: z.string().min(1, 'lead_id é obrigatório'),
  evento: z.enum(
    ['LEAD_NOVO', 'ATUALIZACAO', 'CARRINHO_ABANDONADO', 'MQL', 'SCORE_ATUALIZADO', 'CLIQUE_OFERTA', 'FUNIL_ATUALIZADO'],
    { errorMap: () => ({ message: `evento inválido. Valores aceitos: ${EVENTOS_VALIDOS.join(', ')}` }) }
  ),
  empresa: z.enum(
    ['TOKENIZA', 'BLUE'],
    { errorMap: () => ({ message: `empresa inválida. Valores aceitos: ${EMPRESAS_VALIDAS.join(', ')}` }) }
  ),
  timestamp: z.string().min(1, 'timestamp é obrigatório'),
  score_temperatura: z.number().optional(),
  prioridade: z.enum(['URGENTE', 'QUENTE', 'MORNO', 'FRIO']).optional(),
  dados_lead: sgtDadosLeadSchema,
  dados_linkedin: z.record(z.unknown()).optional(),
  dados_tokeniza: z.record(z.unknown()).optional(),
  dados_blue: z.record(z.unknown()).optional(),
  dados_mautic: z.record(z.unknown()).optional(),
  dados_chatwoot: z.record(z.unknown()).optional(),
  dados_notion: z.record(z.unknown()).optional(),
  event_metadata: z.record(z.unknown()).optional(),
}).passthrough();

export function validatePayload(payload: unknown): { valid: boolean; error?: string; normalized?: Record<string, unknown> } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  const normalized = normalizePayloadFormat(payload as Record<string, unknown>);
  const result = sgtPayloadSchema.safeParse(normalized);

  if (!result.success) {
    const firstError = result.error.issues[0];
    const path = firstError.path.length > 0 ? firstError.path.join('.') + ': ' : '';
    return { valid: false, error: `${path}${firstError.message}` };
  }

  return { valid: true, normalized: normalized };
}

export function generateIdempotencyKey(payload: SGTPayload): string {
  return `${payload.lead_id}_${payload.evento}_${payload.timestamp}`;
}
