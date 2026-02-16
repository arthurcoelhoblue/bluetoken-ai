// ========================================
// bluechat-inbound/schemas.ts — Validação Zod
// ========================================

import { z } from "https://esm.sh/zod@3.25.76";

export const blueChatSchema = z.object({
  conversation_id: z.string().min(1),
  ticket_id: z.string().optional(),
  message_id: z.string().min(1),
  timestamp: z.string().optional(),
  channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']).optional().default('WHATSAPP'),
  contact: z.object({
    phone: z.string().min(8).max(20),
    name: z.string().max(200).optional(),
    email: z.string().email().max(255).optional(),
  }),
  message: z.object({
    type: z.enum(['text', 'audio', 'image', 'document']).optional().default('text'),
    text: z.string().min(1).max(10000),
    media_url: z.string().url().optional(),
  }),
  context: z.object({
    empresa: z.enum(['TOKENIZA', 'BLUE']).optional(),
    tipo_lead: z.enum(['INVESTIDOR', 'CAPTADOR']).optional(),
    agent_id: z.string().optional(),
    tags: z.array(z.string()).optional(),
    history_summary: z.string().optional(),
  }).optional(),
});
