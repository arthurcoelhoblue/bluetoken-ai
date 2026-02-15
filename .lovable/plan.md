

# Fase 3.1 - Testes Auth + Cadence Runner

Adicionar testes unitarios para cobrir fluxos criticos de autenticacao/RBAC e logica de cadencias, sem alterar codigo de producao existente.

---

## 3.1b - Expandir testes Auth

**Arquivo:** `src/contexts/AuthContext.test.tsx` (expandir o existente com ~14 testes)

| Grupo | Testes | O que valida |
|-------|--------|-------------|
| buildPermissionsFromRoles | 6 | ADMIN recebe view+edit em tudo; AUDITOR (`*:read`) recebe view em tudo e edit em nada; READONLY so ve dashboard; CLOSER/SDR_IA/MARKETING mapeiam corretamente para seus recursos |
| Override logic | 4 | Override `{view:true}` prevalece sobre perfil `{view:false}`; override `{view:false}` bloqueia mesmo com perfil permitindo; sem override usa perfil; override afeta apenas a tela especificada |
| Edge cases | 3 | Role inexistente retorna sem permissoes; permissao sem `:` retorna false; roles duplicadas nao causam erro |
| Completude | 1 | Todas as 6 roles definidas em UserRole possuem entrada no ROLE_PERMISSIONS |

Estrategia: replicar a logica pura de `buildPermissionsFromRoles` no teste, seguindo o padrao ja existente no arquivo (funcoes `hasPermission`/`hasRole` replicadas localmente).

---

## 3.1c - Testes Cadence Runner

### Novo arquivo: `src/lib/cadence-logic.ts`

Funcoes puras extraidas da logica de negocios do cadence-runner:

- **computeNextStep**(currentStep, totalSteps, leadRespondeu, pararSeResponder) -- decide se executa, completa ou para
- **computeNextRunAt**(baseDate, offsetMinutos) -- calcula proximo horario de execucao
- **shouldSkipStep**(canal, leadTemCanal) -- pula step se canal indisponivel
- **resolveRunStatus**(currentStatus, action) -- resolve status final da run

### Novo arquivo: `src/lib/__tests__/cadence-logic.test.ts`

| Grupo | Testes | O que valida |
|-------|--------|-------------|
| computeNextStep | 6 | Primeiro step; step intermediario avanca; ultimo step completa; lead respondeu + parar=true para; lead respondeu + parar=false continua; step alem do total completa |
| computeNextRunAt | 3 | Offset 60min soma 1h; offset 0 retorna mesma data; offset 1440 soma 1 dia |
| shouldSkipStep | 3 | WhatsApp sem telefone = skip; Email sem email = skip; canal disponivel = nao skip |
| resolveRunStatus | 4 | EXECUTE mantém ATIVA; COMPLETE vira CONCLUIDA; STOP_RESPONDED vira CONCLUIDA; PAUSADA nao muda |

---

## Sequencia de execucao

1. Criar `src/lib/cadence-logic.ts` com funcoes puras
2. Criar `src/lib/__tests__/cadence-logic.test.ts` com 16 testes
3. Expandir `src/contexts/AuthContext.test.tsx` com 14 testes
4. Rodar testes para validar que todos passam
5. Atualizar `.lovable/plan.md` marcando 3.1b e 3.1c como concluidos

## Impacto

- Zero mudancas em codigo de producao existente
- Nenhum import existente afetado
- Adicao de 1 arquivo de logica pura + 1 arquivo de teste novo + expansao de 1 arquivo de teste existente
- Total: ~30 testes adicionais

