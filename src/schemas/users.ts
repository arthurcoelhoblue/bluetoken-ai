import { z } from 'zod';

export const createUserSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  profileId: z.string().optional().or(z.literal('')),
  empresa: z.string().default('all'),
  gestorId: z.string().default('none'),
  isVendedor: z.boolean().default(false),
  ramal: z.string().optional().or(z.literal('')),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
