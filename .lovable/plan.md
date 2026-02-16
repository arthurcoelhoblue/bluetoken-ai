

# Fases 4, 5 e 6 -- Finalizacao do Hardening Multi-Tenancy

---

## Fase 4 -- Triggers de Validacao (Defesa em Profundidade)

Uma migracao SQL criando 2 triggers que impedem corrupcao cross-tenant em writes criticos:

### Trigger 1: `validate_deal_pipeline_tenant`
- **Tabela**: `deals`
- **Evento**: BEFORE INSERT OR UPDATE
- **Regra**: Verifica que o `pipeline_id` pertence a mesma `empresa` do `contact_id`
- Se divergirem, levanta EXCEPTION impedindo o write

### Trigger 2: `validate_activity_tenant`
- **Tabela**: `deal_activities`
- **Evento**: BEFORE INSERT
- **Regra**: Resolve a empresa do deal associado (via `deals -> pipelines`) e valida consistencia
- Impede que uma atividade seja criada vinculada a um deal de outro tenant

---

## Fase 5 -- Testes de Isolamento Expandidos

Expandir `supabase/functions/_shared/tenant_test.ts` com testes HTTP para as 6 funcoes do Grupo A refatoradas na Fase 3:

| Teste | Funcao | Cenario |
|-------|--------|---------|
| 1 | `next-best-action` | Sem empresa -> erro 500 |
| 2 | `next-best-action` | Empresa invalida ("ACME") -> erro 500 |
| 3 | `amelia-mass-action` | Sem empresa -> erro 500 |
| 4 | `amelia-mass-action` | Empresa invalida -> erro 500 |
| 5 | `cs-suggest-note` | Sem empresa/customer -> erro 500 |
| 6 | `cs-suggest-note` | Empresa invalida -> erro 500 |

Nota: `deal-context-summary`, `call-coach` e `amelia-learn` extraem empresa do contexto da entidade (nao do body), entao seus testes validam que chamadas sem dados retornam erro.

---

## Fase 6 -- Documentacao e ADR

### Arquivo 1: `.lovable/plan.md`
Marcar Fases 4, 5 e 6 como concluidas com detalhes.

### Arquivo 2: `docs-site/docs/desenvolvedor/multi-tenancy.md`
Adicionar secoes:
- **Defesa em Profundidade**: Descricao dos triggers de validacao
- **Edge Functions**: Padrao `assertEmpresa` + filtros explicitos
- **ADR**: Decisao de usar filtros explicitos ao inves de `createTenantClient` automatico
- **Status de Cobertura**: Lista completa das 9 funcoes hardened + classificacao das demais

### Arquivo 3: `docs-site/docs/admin/multi-tenancy.md`
Adicionar nota sobre triggers de validacao como camada extra de seguranca.

---

## Resumo de Mudancas

| Arquivo | Tipo | Acao |
|---------|------|------|
| SQL Migration | Novo | 2 triggers de validacao |
| `supabase/functions/_shared/tenant_test.ts` | Editar | +6 testes HTTP |
| `.lovable/plan.md` | Editar | Marcar fases 4-6 concluidas |
| `docs-site/docs/desenvolvedor/multi-tenancy.md` | Editar | ADR + cobertura completa |
| `docs-site/docs/admin/multi-tenancy.md` | Editar | Nota sobre triggers |

Total: 1 migracao SQL + 4 arquivos editados.

