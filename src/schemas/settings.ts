import { z } from 'zod';

export const generalSettingsSchema = z.object({
  horario_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  horario_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  dias: z.array(z.string()).min(1, 'Selecione pelo menos um dia'),
  max_por_dia: z.coerce.number().int().min(1, 'Mínimo 1').max(50, 'Máximo 50'),
  intervalo_minutos: z.coerce.number().int().min(1, 'Mínimo 1').max(1440, 'Máximo 1440'),
  tom: z.enum(['profissional', 'informal', 'formal']),
  auto_escalar_apos: z.coerce.number().int().min(1, 'Mínimo 1').max(20, 'Máximo 20'),
  qualificacao_automatica: z.boolean(),
});

export type GeneralSettingsFormData = z.infer<typeof generalSettingsSchema>;
