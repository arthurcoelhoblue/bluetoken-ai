import { z } from 'zod';

export const captureFormSaveSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  descricao: z.string().max(500).nullable().optional(),
  pipeline_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().uuid().nullable().optional(),
  fields: z.array(z.object({
    id: z.string(),
    type: z.enum(['short_text', 'long_text', 'email', 'phone', 'single_select', 'multi_select', 'number']),
    label: z.string().min(1, 'Label é obrigatório'),
    required: z.boolean(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).min(1, 'Adicione pelo menos uma pergunta'),
});

export type CaptureFormSaveData = z.infer<typeof captureFormSaveSchema>;
