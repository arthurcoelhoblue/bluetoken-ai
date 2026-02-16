import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema, forgotPasswordSchema } from '@/schemas/auth';
import { contactCreateSchema, organizationCreateSchema } from '@/schemas/contacts';
import { createDealSchema } from '@/schemas/deals';
import { createUserSchema } from '@/schemas/users';
import { faqCreateSchema } from '@/schemas/knowledge';
import { sendEmailSchema } from '@/schemas/email';
import { generalSettingsSchema } from '@/schemas/settings';
import { captureFormSaveSchema } from '@/schemas/captureForms';

// ─── Auth Schemas ──────────────────────────────────────────
describe('loginSchema', () => {
  it('accepts valid email + password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123456' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: '123456' }).success).toBe(false);
  });
  it('rejects password < 6', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '12345' }).success).toBe(false);
  });
});

describe('signupSchema', () => {
  const valid = { nome: 'João', email: 'j@b.com', password: '12345678', confirmPassword: '12345678' };

  it('accepts valid data', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects mismatched passwords', () => {
    expect(signupSchema.safeParse({ ...valid, confirmPassword: 'different' }).success).toBe(false);
  });
  it('rejects nome < 2', () => {
    expect(signupSchema.safeParse({ ...valid, nome: 'A' }).success).toBe(false);
  });
  it('rejects invalid email', () => {
    expect(signupSchema.safeParse({ ...valid, email: 'bad' }).success).toBe(false);
  });
  it('rejects password < 8', () => {
    expect(signupSchema.safeParse({ ...valid, password: '1234567', confirmPassword: '1234567' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
  it('rejects empty', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });
});

// ─── Contacts Schemas ──────────────────────────────────────
describe('contactCreateSchema', () => {
  it('accepts valid nome', () => {
    expect(contactCreateSchema.safeParse({ nome: 'Maria Silva' }).success).toBe(true);
  });
  it('rejects nome < 2', () => {
    expect(contactCreateSchema.safeParse({ nome: 'A' }).success).toBe(false);
  });
  it('accepts empty email (optional)', () => {
    expect(contactCreateSchema.safeParse({ nome: 'Maria', email: '' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(contactCreateSchema.safeParse({ nome: 'Maria', email: 'bad' }).success).toBe(false);
  });
  it('accepts CPF formatted', () => {
    expect(contactCreateSchema.safeParse({ nome: 'Maria', cpf: '123.456.789-00' }).success).toBe(true);
  });
  it('accepts CPF unformatted 11 digits', () => {
    expect(contactCreateSchema.safeParse({ nome: 'Maria', cpf: '12345678900' }).success).toBe(true);
  });
  it('rejects invalid CPF', () => {
    expect(contactCreateSchema.safeParse({ nome: 'Maria', cpf: '123' }).success).toBe(false);
  });
  it('accepts valid tipo enum', () => {
    expect(contactCreateSchema.safeParse({ nome: 'Maria', tipo: 'LEAD' }).success).toBe(true);
  });
});

describe('organizationCreateSchema', () => {
  it('accepts valid nome', () => {
    expect(organizationCreateSchema.safeParse({ nome: 'Empresa ABC' }).success).toBe(true);
  });
  it('rejects nome < 2', () => {
    expect(organizationCreateSchema.safeParse({ nome: 'A' }).success).toBe(false);
  });
  it('accepts CNPJ 14 digits', () => {
    expect(organizationCreateSchema.safeParse({ nome: 'Emp', cnpj: '12345678000199' }).success).toBe(true);
  });
  it('rejects invalid CNPJ', () => {
    expect(organizationCreateSchema.safeParse({ nome: 'Emp', cnpj: '123' }).success).toBe(false);
  });
  it('accepts formatted CNPJ', () => {
    expect(organizationCreateSchema.safeParse({ nome: 'Emp', cnpj: '12.345.678/0001-99' }).success).toBe(true);
  });
  it('validates estado max 2 chars', () => {
    expect(organizationCreateSchema.safeParse({ nome: 'Emp', estado: 'SPX' }).success).toBe(false);
  });
  it('accepts estado 2 chars', () => {
    expect(organizationCreateSchema.safeParse({ nome: 'Emp', estado: 'SP' }).success).toBe(true);
  });
});

// ─── Deals Schema ──────────────────────────────────────────
describe('createDealSchema', () => {
  const base = { owner_id: 'test-user-id' };

  it('accepts valid titulo + valor', () => {
    expect(createDealSchema.safeParse({ ...base, titulo: 'Deal X', valor: 1000 }).success).toBe(true);
  });
  it('rejects titulo < 2', () => {
    expect(createDealSchema.safeParse({ ...base, titulo: 'D', valor: 100 }).success).toBe(false);
  });
  it('rejects negative valor', () => {
    expect(createDealSchema.safeParse({ ...base, titulo: 'Deal', valor: -1 }).success).toBe(false);
  });
  it('defaults temperatura to FRIO', () => {
    const result = createDealSchema.safeParse({ ...base, titulo: 'Deal X' });
    expect(result.success && result.data.temperatura).toBe('FRIO');
  });
  it('accepts QUENTE', () => {
    expect(createDealSchema.safeParse({ ...base, titulo: 'Deal', temperatura: 'QUENTE' }).success).toBe(true);
  });
  it('rejects missing owner_id', () => {
    expect(createDealSchema.safeParse({ titulo: 'Deal X', valor: 100 }).success).toBe(false);
  });
});

// ─── Users Schema ──────────────────────────────────────────
describe('createUserSchema', () => {
  const valid = { nome: 'Ana', email: 'ana@x.com', password: '123456' };

  it('accepts valid data', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(createUserSchema.safeParse({ ...valid, email: 'bad' }).success).toBe(false);
  });
  it('rejects password < 6', () => {
    expect(createUserSchema.safeParse({ ...valid, password: '12345' }).success).toBe(false);
  });
  it('rejects nome < 2', () => {
    expect(createUserSchema.safeParse({ ...valid, nome: 'A' }).success).toBe(false);
  });
});

// ─── Knowledge Schema ──────────────────────────────────────
describe('faqCreateSchema', () => {
  it('accepts valid pergunta + resposta', () => {
    expect(faqCreateSchema.safeParse({ pergunta: 'Como funciona?', resposta: 'Funciona assim, com detalhes.' }).success).toBe(true);
  });
  it('rejects pergunta < 5', () => {
    expect(faqCreateSchema.safeParse({ pergunta: 'Oi?', resposta: 'Funciona assim, com detalhes.' }).success).toBe(false);
  });
  it('rejects resposta < 10', () => {
    expect(faqCreateSchema.safeParse({ pergunta: 'Como funciona?', resposta: 'Sim.' }).success).toBe(false);
  });
});

// ─── Email Schema ──────────────────────────────────────────
describe('sendEmailSchema', () => {
  const valid = { to: 'a@b.com', subject: 'Teste', body: 'Mensagem aqui' };

  it('accepts valid data', () => {
    expect(sendEmailSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(sendEmailSchema.safeParse({ ...valid, to: 'bad' }).success).toBe(false);
  });
  it('rejects empty subject', () => {
    expect(sendEmailSchema.safeParse({ ...valid, subject: '' }).success).toBe(false);
  });
  it('rejects subject > 200', () => {
    expect(sendEmailSchema.safeParse({ ...valid, subject: 'x'.repeat(201) }).success).toBe(false);
  });
});

// ─── Settings Schema ──────────────────────────────────────
describe('generalSettingsSchema', () => {
  const valid = {
    horario_inicio: '08:00', horario_fim: '18:00',
    dias: ['seg'], max_por_dia: 10, intervalo_minutos: 30,
    tom: 'profissional' as const, auto_escalar_apos: 5, qualificacao_automatica: true,
  };

  it('accepts valid data', () => {
    expect(generalSettingsSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects invalid HH:MM format', () => {
    expect(generalSettingsSchema.safeParse({ ...valid, horario_inicio: '8am' }).success).toBe(false);
  });
  it('rejects max_por_dia > 50', () => {
    expect(generalSettingsSchema.safeParse({ ...valid, max_por_dia: 51 }).success).toBe(false);
  });
  it('rejects max_por_dia < 1', () => {
    expect(generalSettingsSchema.safeParse({ ...valid, max_por_dia: 0 }).success).toBe(false);
  });
  it('rejects intervalo_minutos > 1440', () => {
    expect(generalSettingsSchema.safeParse({ ...valid, intervalo_minutos: 1441 }).success).toBe(false);
  });
  it('rejects empty dias', () => {
    expect(generalSettingsSchema.safeParse({ ...valid, dias: [] }).success).toBe(false);
  });
});

// ─── CaptureForms Schema ──────────────────────────────────
describe('captureFormSaveSchema', () => {
  const validField = { id: '1', type: 'short_text' as const, label: 'Nome', required: true };

  it('accepts valid form', () => {
    expect(captureFormSaveSchema.safeParse({ nome: 'Formulário', fields: [validField] }).success).toBe(true);
  });
  it('rejects empty fields', () => {
    expect(captureFormSaveSchema.safeParse({ nome: 'Formulário', fields: [] }).success).toBe(false);
  });
  it('rejects nome < 2', () => {
    expect(captureFormSaveSchema.safeParse({ nome: 'F', fields: [validField] }).success).toBe(false);
  });
});
