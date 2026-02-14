import { z } from 'zod';

export const createDealSchema = z.object({
  titulo: z.string().trim().min(2, 'Título deve ter no mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  valor: z.coerce.number().min(0, 'Valor não pode ser negativo').default(0),
  temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).default('FRIO'),
  contact_id: z.string().optional(),
  contact_nome: z.string().optional(),
  stage_id: z.string().optional(),
});

export type CreateDealFormData = z.infer<typeof createDealSchema>;
