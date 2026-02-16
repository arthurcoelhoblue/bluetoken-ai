

# Bloco 4.1 — Multi-tenancy com Schema Views + RLS Hardening

## Resumo Executivo

Implementar isolamento real por empresa usando **schemas dedicados** (`blue`, `tokeniza`) com **views auto-filtradas** sobre as tabelas do schema `public`. Isso garante:

- Escalabilidade para N empresas futuras (basta criar um novo schema com views)
- Zero quebra no frontend (continua usando `public` via Supabase JS)
- Camada extra de seguranca nas Edge Functions (podem usar views do schema do tenant)
- RLS hardening completo em tabelas que hoje tem lacunas

---

## Diagnostico Atual

### Tabelas COM coluna `empresa` (70 tabelas/views) -- ja filtram por tenant:
`contacts`, `cadences`, `pipelines`, `organizations`, `cs_customers`, `cs_incidents`, `lead_contacts`, `lead_messages`, `notifications`, etc.

### Tabelas SEM coluna `empresa` (26 tabelas) -- precisam de tratamento:

| Tabela | Estrategia |
|---|---|
| `deals` | Empresa via JOIN com `pipelines` -- documentado e funcional |
| `deal_activities`, `deal_stage_history`, `deal_cadence_runs` | Empresa via JOIN deals->pipelines |
| `pipeline_stages` | Empresa via JOIN com `pipelines` |
| `cadence_steps`, `cadence_stage_triggers` | Empresa via JOIN com `cadences`/`pipelines` |
| `lead_cadence_events` | Empresa via JOIN com `lead_cadence_runs` |
| `custom_field_values` | Empresa via entidade referenciada |
| `profiles`, `user_roles`, `access_profiles` | Tabelas de identidade -- nao sao por tenant |
| `system_settings`, `prompt_versions`, `ai_model_benchmarks` | Config global -- nao sao por tenant |
| `ai_rate_limits`, `webhook_rate_limits`, `seller_badges` | Infraestrutura -- nao sao por tenant |
| `pessoas` | Ja tem RLS por empresa via `get_user_empresa` |
| `knowledge_documents`, `knowledge_sections` | Empresa via `product_knowledge` |

### Problemas de RLS identificados (linter):
- 5 policies com `USING (true)` em INSERT/UPDATE/DELETE (permissivas demais)
- 4 views com SECURITY DEFINER (risco de bypass de RLS)
- 1 tabela com RLS habilitado mas sem policies

---

## Plano de Implementacao

### Fase 1: Criar schemas e views auto-filtradas

**Migracao SQL:**
1. Criar schemas `blue` e `tokeniza`
2. Para cada tabela core com coluna `empresa`, criar uma VIEW no schema correspondente que filtra automaticamente:

```text
CREATE VIEW blue.contacts AS
  SELECT * FROM public.contacts WHERE empresa = 'BLUE';

CREATE VIEW tokeniza.contacts AS
  SELECT * FROM public.contacts WHERE empresa = 'TOKENIZA';
```

3. Para tabelas sem `empresa` mas com relacao indireta (ex: `deals`):

```text
CREATE VIEW blue.deals AS
  SELECT d.* FROM public.deals d
  JOIN public.pipelines p ON p.id = d.pipeline_id
  WHERE p.empresa = 'BLUE';
```

4. Criar funcao helper `create_tenant_views(empresa TEXT)` que gera todas as views automaticamente para novos tenants

**Tabelas que terao views em cada schema (~20 tabelas core):**
- `contacts`, `organizations`, `deals`, `deal_activities`, `pipeline_stages`, `pipelines`
- `cadences`, `cadence_steps`, `lead_contacts`, `lead_messages`, `lead_cadence_runs`
- `cs_customers`, `cs_incidents`, `cs_playbooks`, `cs_surveys`
- `notifications`, `message_templates`, `capture_forms`
- `calls`, `comissao_lancamentos`, `metas_vendedor`

### Fase 2: RLS Hardening

1. **Corrigir policies permissivas** (`USING (true)` em write operations):
   - Auditar e restringir para `auth.uid() IS NOT NULL` + verificacao de empresa
   
2. **Corrigir views SECURITY DEFINER**:
   - Converter para SECURITY INVOKER onde possivel
   - Manter DEFINER apenas onde necessario com justificativa

3. **Adicionar policies faltantes**:
   - Tabela com RLS habilitado sem policies

### Fase 3: Funcao de provisionamento automatico

Criar `provision_tenant_schema(empresa_nome TEXT)`:
- Cria o schema
- Gera todas as views padrao
- Configura grants de acesso
- Pronto para quando a 3a, 4a empresa entrarem

### Fase 4: Documentacao e Edge Functions

1. Atualizar `.lovable/plan.md` com resultado
2. Documentar como Edge Functions podem optar por usar views do schema tenant como camada extra de seguranca
3. Nao alterar frontend (zero impacto)

---

## Detalhes Tecnicos

### Grants necessarios
```text
GRANT USAGE ON SCHEMA blue TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA blue TO authenticated;
```

### Seguranca das Views
- Views serao criadas como `SECURITY INVOKER` (padrao) -- respeitam RLS do usuario que consulta
- Isso significa dupla protecao: a VIEW filtra por empresa E o RLS valida permissoes do usuario

### Impacto no Frontend
- **Zero** -- o frontend continua usando `supabase.from('contacts')` que acessa `public.contacts`
- As views nos schemas tenant sao uma camada opcional para backend/Edge Functions

### Impacto nas Edge Functions
- Nenhuma alteracao obrigatoria
- Edge Functions que usam `service_role` podem optar por usar `blue.contacts` em vez de `public.contacts` para garantia adicional

### Escalabilidade
- Adicionar empresa 3 (ex: "ACME"): basta rodar `SELECT provision_tenant_schema('ACME')`
- Todas as views sao criadas automaticamente

---

## Estimativa

| Fase | Complexidade | Risco |
|---|---|---|
| Fase 1: Schemas + Views | Media | Baixo (aditivo, nao muda nada existente) |
| Fase 2: RLS Hardening | Media | Medio (pode bloquear operacoes se policy errada) |
| Fase 3: Funcao provisionamento | Baixa | Baixo |
| Fase 4: Documentacao | Baixa | Zero |

