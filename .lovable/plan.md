

# Fase 2.3 - Refatorar Edge Functions Grandes

Extrair logica duplicada das 3 maiores edge functions para modulos compartilhados, reduzindo duplicacao e melhorando manutenibilidade.

---

## Problema Atual

| Funcao | Linhas | Problema |
|--------|--------|----------|
| sgt-webhook | 2.254 | Monolito com classificacao, dedup, sanitizacao, cadencia, CRM, pessoa |
| bluechat-inbound | 1.576 | Duplica dedup, pipeline routing, phone normalization do sgt-webhook |
| cadence-runner | 986 | Duplica horario comercial, template resolution |

### Codigo Duplicado Identificado

Estas funcoes aparecem identicas (ou quase) em 2+ arquivos:

- `isPlaceholderEmailForDedup` -- sgt-webhook + bluechat-inbound
- `generatePhoneVariationsForSearch` -- sgt-webhook + bluechat-inbound
- `resolveTargetPipeline` -- sgt-webhook + bluechat-inbound (mesmos UUIDs hardcoded)
- `findExistingDealForPerson` -- sgt-webhook + bluechat-inbound
- `getHorarioBrasilia` / `isHorarioComercial` / `proximoHorarioComercial` -- sgt-webhook + cadence-runner
- `normalizePhone` / phone E.164 logic -- sgt-webhook + bluechat-inbound

---

## Estrategia

Mover logica compartilhada para `supabase/functions/_shared/`, que ja existe com `cors.ts`, `logger.ts` e `ai-provider.ts`. Edge functions em Deno importam de `../_shared/`.

Nao vamos alterar comportamento nenhum -- apenas mover funcoes para arquivos compartilhados e substituir por imports.

---

## Novos Arquivos Shared

### 1. `supabase/functions/_shared/types.ts`

Tipos compartilhados (evitar redeclaracao):
- `EmpresaTipo`, `Temperatura`, `TipoLead`, `CanalTipo`
- `LeadContact`, `LeadCadenceRun`
- Interfaces de payload comuns

### 2. `supabase/functions/_shared/phone-utils.ts`

Funcoes extraidas:
- `normalizePhoneE164(raw)` -- normalizacao completa para E.164
- `generatePhoneVariationsForSearch(phone)` -- variacoes para busca
- `isPlaceholderEmailForDedup(email)` -- deteccao de emails placeholder
- Constantes: `PLACEHOLDER_EMAILS_DEDUP`, `DDI_CONHECIDOS`

### 3. `supabase/functions/_shared/business-hours.ts`

Funcoes extraidas:
- `getHorarioBrasilia()` -- data atual em BRT
- `isHorarioComercial()` -- verifica seg-sex 09h-18h
- `proximoHorarioComercial()` -- calcula proximo horario util

### 4. `supabase/functions/_shared/pipeline-routing.ts`

Funcoes extraidas:
- `resolveTargetPipeline(empresa, tipoLead, temperatura, isPriority)` -- mapa de pipelines/stages
- `findExistingDealForPerson(supabase, empresa, dados)` -- dedup de contatos/deals
- Constantes: todos os UUIDs de pipelines e stages

---

## Impacto por Edge Function

### sgt-webhook (2.254 -> ~1.600 linhas)

Remover: `isPlaceholderEmailForDedup`, `generatePhoneVariationsForSearch`, `resolveTargetPipeline`, `findExistingDealForPerson`, `getHorarioBrasilia`/`isHorarioComercial`/`proximoHorarioComercial`, `normalizePhoneE164`, constantes DDI, tipos duplicados. Substituir por imports.

### bluechat-inbound (1.576 -> ~1.100 linhas)

Remover: `isPlaceholderEmailForDedup`, `generatePhoneVariationsForSearch`, `generatePhoneVariations`, `resolveTargetPipeline`, `findExistingDealForPerson`, `normalizePhone`, tipos duplicados. Substituir por imports.

### cadence-runner (986 -> ~750 linhas)

Remover: `getHorarioBrasilia`/`isHorarioComercial`/`proximoHorarioComercial`, tipos duplicados. Substituir por imports.

---

## Sequencia de Execucao

1. Criar `_shared/types.ts` com tipos compartilhados
2. Criar `_shared/phone-utils.ts` com funcoes de telefone/email
3. Criar `_shared/business-hours.ts` com funcoes de horario
4. Criar `_shared/pipeline-routing.ts` com roteamento e dedup
5. Refatorar `cadence-runner/index.ts` (menor risco)
6. Refatorar `bluechat-inbound/index.ts`
7. Refatorar `sgt-webhook/index.ts` (maior, mais critico)
8. Deploy e validacao via logs

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|----------|
| Quebrar imports Deno | Usar caminhos relativos `../_shared/` ja validados (cors.ts funciona) |
| Divergencia sutil entre versoes duplicadas | Comparar linha a linha antes de consolidar; usar a versao mais completa |
| Regressao em producao | Deploy incremental; monitorar logs apos cada funcao |

## Resultado Esperado

- ~650 linhas de codigo duplicado eliminadas
- 4 modulos compartilhados reutilizaveis
- Zero mudanca de comportamento
- Facilita manutencao futura (corrigir bug em 1 lugar, nao em 3)

