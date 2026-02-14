import { z } from 'zod';

export const contactCreateSchema = z.object({
  primeiro_nome: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  sobrenome: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  nome: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  telefone: z.string().max(30, 'Telefone muito longo').optional().or(z.literal('')),
  cpf: z.string().regex(/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})?$/, 'CPF inválido').optional().or(z.literal('')),
  tipo: z.enum(['LEAD', 'CLIENTE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO']).optional(),
  canal_origem: z.string().max(50).optional().or(z.literal('')),
  organization_id: z.string().uuid().optional().or(z.literal('')),
  notas: z.string().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  is_cliente: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export type ContactCreateFormData = z.infer<typeof contactCreateSchema>;

export const organizationCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Razão social deve ter no mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  nome_fantasia: z.string().max(200).optional().or(z.literal('')),
  cnpj: z.string().regex(/^(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})?$/, 'CNPJ inválido').optional().or(z.literal('')),
  telefone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  setor: z.string().max(100).optional().or(z.literal('')),
  porte: z.string().max(50).optional().or(z.literal('')),
  website: z.string().max(500).optional().or(z.literal('')),
  endereco: z.string().max(500).optional().or(z.literal('')),
  cidade: z.string().max(100).optional().or(z.literal('')),
  estado: z.string().max(2, 'Máximo 2 caracteres').optional().or(z.literal('')),
  cep: z.string().max(10).optional().or(z.literal('')),
});

export type OrgCreateFormData = z.infer<typeof organizationCreateSchema>;
