

# Validacao com Zod (4.4) -- Melhoria do Relatorio PO

## Resumo

Atualmente, apenas **4 formularios** no projeto usam Zod para validacao (Login, Signup, Forgot Password e Template). Os demais **~10 formularios criticos** utilizam validacao manual com `if (!campo.trim())` e `toast.error()`, sem mensagens inline nos campos, sem limites de comprimento e sem sanitizacao adequada. Nenhuma edge function usa validacao de schema no servidor.

---

## Diagnostico: Estado Atual

| Formulario | Validacao Atual | Risco |
|------------|----------------|-------|
| ContactCreateDialog | `if (!nome.trim())` + toast | ALTO -- sem validacao de email/telefone |
| OrgCreateDialog | `if (!nome.trim())` + toast | ALTO -- CNPJ sem formato, email sem validacao |
| CreateDealDialog | `if (!titulo.trim())` + toast | MEDIO -- valor negativo possivel |
| CreateUserDialog | `if (!nome \|\| !email \|\| !password)` + toast | ALTO -- email invalido aceito |
| FaqFormDialog | `if (!pergunta.trim())` + toast | BAIXO |
| EmailFromDealDialog | `if (!to.trim())` + toast | ALTO -- email invalido enviado ao servidor |
| MetaAnualDialog | Nenhuma | MEDIO -- valores negativos possiveis |
| AccessProfileEditor | `if (!nome.trim())` | BAIXO |
| CaptureFormBuilderPage | Nenhuma | MEDIO |
| GeneralTab (Settings) | useForm sem zodResolver | MEDIO -- sem limites em numeros |
| **Edge Functions** | `if (!field)` manual | ALTO -- sem validacao de tipo/formato |

---

## Plano de Implementacao

### Fase 1: Criar schemas centralizados em `src/schemas/`

Criar arquivos de schema Zod organizados por dominio, seguindo o padrao ja existente em `src/schemas/auth.ts`:

**Arquivos a criar:**

1. **`src/schemas/contacts.ts`** -- Schema para contatos e organizacoes
   - `contactCreateSchema`: nome (min 2, max 100), email (opcional, formato valido), telefone (opcional, regex), cpf (opcional, regex), tipo (enum)
   - `organizationCreateSchema`: nome (min 2, max 200), cnpj (opcional, regex 14 digitos), email (opcional, formato), estado (max 2)

2. **`src/schemas/deals.ts`** -- Schema para deals
   - `createDealSchema`: titulo (min 2, max 200), valor (number >= 0), temperatura (enum FRIO/MORNO/QUENTE)

3. **`src/schemas/users.ts`** -- Schema para criacao de usuarios
   - `createUserSchema`: nome (min 2, max 100), email (email valido), password (min 6), empresa (enum)

4. **`src/schemas/knowledge.ts`** -- Schema para FAQ
   - `faqCreateSchema`: pergunta (min 5, max 500), resposta (min 10, max 5000), categoria (enum)

5. **`src/schemas/email.ts`** -- Schema para envio de email
   - `sendEmailSchema`: to (email valido), subject (min 1, max 200), body (min 1, max 10000)

6. **`src/schemas/settings.ts`** -- Schema para configuracoes
   - `generalSettingsSchema`: horario_inicio (regex HH:MM), horario_fim, max_por_dia (1-50), intervalo_minutos (1-1440), tom (enum), auto_escalar_apos (1-20)

7. **`src/schemas/captureForms.ts`** -- Schema para builder de formularios
   - `captureFormSaveSchema`: nome (min 2, max 100), pipeline_id (uuid opcional), fields (array)

### Fase 2: Migrar formularios para useForm + zodResolver

Refatorar cada componente para usar `react-hook-form` com `zodResolver`, substituindo os `useState` avulsos por form controlado com mensagens de erro inline:

**Componentes a alterar:**

1. **`ContactCreateDialog.tsx`** -- Substituir `useState<Partial<ContactFormData>>` por `useForm` com `contactCreateSchema`
2. **`OrgCreateDialog.tsx`** -- Mesmo padrao, com `organizationCreateSchema`
3. **`CreateDealDialog.tsx`** -- Migrar para `useForm` com `createDealSchema`
4. **`CreateUserDialog.tsx`** -- Migrar para `useForm` com `createUserSchema`
5. **`FaqFormDialog.tsx`** -- Migrar para `useForm` com `faqCreateSchema`
6. **`EmailFromDealDialog.tsx`** -- Migrar para `useForm` com `sendEmailSchema`
7. **`GeneralTab.tsx`** -- Adicionar `zodResolver(generalSettingsSchema)` ao useForm existente
8. **`AccessProfileEditor.tsx`** -- Adicionar schema basico para nome
9. **`CaptureFormBuilderPage.tsx`** -- Validacao no save com `captureFormSaveSchema`

### Fase 3: Bonus -- Remover `as any` residuais nos formularios

- `ContactCreateDialog.tsx` linha 50: `value: any` no setter
- `CreateDealDialog.tsx` linha 115: `v as any` no Select de temperatura
- `EmailFromDealDialog.tsx` linha 62: `catch (e: any)`
- `TemplateFormDialog.tsx` linha 79: `payload: any`

### Fase 4: Adicionar validacao server-side nas edge functions criticas

Usar Zod via `https://esm.sh/zod@3` nas edge functions:

1. **`capture-form-submit`** -- Validar slug (string), answers (record), metadata (object)
2. **`admin-create-user`** -- Validar email (formato), nome (min 2), password (min 6)
3. **`email-send`** -- Validar to (email), subject (string), html (string)

---

## Ordem de Execucao

```text
1. Fase 1 -- Criar os 7 arquivos de schemas (~15 min)
2. Fase 2 -- Migrar os 9 componentes para useForm+Zod (~30 min)
3. Fase 3 -- Limpar as any residuais nos formularios (~5 min)
4. Fase 4 -- Validacao Zod nas 3 edge functions criticas (~10 min)
```

## Impacto Esperado

- 100% dos formularios com validacao estruturada e mensagens inline
- Limites de comprimento em todos os campos de texto (prevencao de payloads enormes)
- Validacao de formato em emails, telefones, CPF e CNPJ
- Validacao duplicada client + server nas rotas mais criticas
- Zero mudanca de comportamento para o usuario final -- apenas melhor feedback de erros

## Detalhes Tecnicos

- Zod ja esta instalado (`zod@3.25.76`) e configurado com `@hookform/resolvers`
- O padrao `useForm + zodResolver` ja existe em 4 componentes (auth + templates) e sera replicado
- Schemas ficam em `src/schemas/*.ts`, separados por dominio
- Edge functions importam Zod via `https://esm.sh/zod@3`
- Nenhuma migracao de banco necessaria
- Nenhuma alteracao de tipo em `src/types/` -- os schemas Zod geram seus proprios tipos via `z.infer`

