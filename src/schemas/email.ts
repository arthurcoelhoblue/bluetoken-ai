import { z } from 'zod';

export const sendEmailSchema = z.object({
  to: z.string().trim().email('Email inválido'),
  subject: z.string().trim().min(1, 'Assunto é obrigatório').max(200, 'Máximo 200 caracteres'),
  body: z.string().trim().min(1, 'Mensagem é obrigatória').max(10000, 'Máximo 10000 caracteres'),
});

export type SendEmailFormData = z.infer<typeof sendEmailSchema>;
