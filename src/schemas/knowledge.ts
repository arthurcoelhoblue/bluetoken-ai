import { z } from 'zod';

export const faqCreateSchema = z.object({
  pergunta: z.string().trim().min(5, 'Pergunta deve ter no mínimo 5 caracteres').max(500, 'Máximo 500 caracteres'),
  resposta: z.string().trim().min(10, 'Resposta deve ter no mínimo 10 caracteres').max(5000, 'Máximo 5000 caracteres'),
  categoria: z.string().default('Outros'),
  tags: z.array(z.string()).default([]),
});

export type FaqCreateFormData = z.infer<typeof faqCreateSchema>;
