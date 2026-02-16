

# Fase D — Decomposicao do sgt-webhook e bluechat-inbound

## Principio

Extrair modulos sem alterar nenhuma logica de negocio. Cada modulo e um arquivo `.ts` dentro da pasta da propria funcao, importado pelo `index.ts`. O handler principal (`serve()`) permanece no `index.ts` como orquestrador.

---

## Parte 1: sgt-webhook (2.077 linhas -> ~250 no index.ts)

### Arquivo 1: `sgt-webhook/types.ts` (~210 linhas)
Conteudo extraido (linhas 24-248):
- Todos os `type` e `interface` locais: `SGTEventoTipo`, `EmpresaTipo`, `PrioridadeMarketing`, `LeadStage`, `OrigemTipo`, `Prioridade`, `IcpTokeniza`, `IcpBlue`, `ICP`, `PersonaTokeniza`, `PersonaBlue`, `Persona`, `CadenceCodigo`
- Interfaces: `DadosLead`, `DadosTokeniza`, `DadosBlue`, `DadosMautic`, `DadosChatwoot`, `DadosLinkedin`, `DadosNotion`, `EventMetadata`, `SGTPayload`, `LeadNormalizado`, `LeadClassificationResult`
- Tipos de sanitizacao: `LeadContactIssueTipo`, `ContactIssue`, `SanitizationResult`, `ScoreBreakdown`
- Constantes: `EVENTOS_VALIDOS`, `EMPRESAS_VALIDAS`, `LEAD_STAGES_VALIDOS`, `EVENTOS_QUENTES`

### Arquivo 2: `sgt-webhook/validation.ts` (~120 linhas)
Conteudo extraido (linhas 778-877):
- `normalizePayloadFormat()`
- Schemas Zod: `sgtDadosLeadSchema`, `sgtPayloadSchema`
- `validatePayload()`
- `generateIdempotencyKey()`

### Arquivo 3: `sgt-webhook/normalization.ts` (~200 linhas)
Conteudo extraido (linhas 278-743):
- `normalizeStage()`
- `isPlaceholderEmail()`, `isValidEmailFormat()`
- `sanitizeLeadContact()`
- `extractPhoneBase()`, `upsertPessoaFromContact()`
- `normalizeSGTEvent()`

### Arquivo 4: `sgt-webhook/classification.ts` (~285 linhas)
Conteudo extraido (linhas 886-1286):
- `classificarTokeniza()`, `classificarBlue()`
- `calcularTemperatura()`, `calcularPrioridade()`
- `calcularScoreInterno()`
- `classificarLead()` (funcao orquestradora de classificacao)

### Arquivo 5: `sgt-webhook/cadence.ts` (~165 linhas)
Conteudo extraido (linhas 1291-1454):
- `decidirCadenciaParaLead()`
- `iniciarCadenciaParaLead()`

### Arquivo 6: `sgt-webhook/auth.ts` (~30 linhas)
Conteudo extraido (linhas 748-774):
- `validateWebhookToken()`

### Resultado: `sgt-webhook/index.ts` (~250 linhas)
Apenas:
- Imports dos modulos acima + `_shared/`
- `serve()` handler com o fluxo principal orquestrado
- Rate limiting, idempotency check, upsert lead_contacts, sanitizacao call, contacts CRM merge, conversation state, classificacao call, deal auto-create, cadencia call, response

---

## Parte 2: bluechat-inbound (1.507 linhas -> ~400 no index.ts)

### Arquivo 1: `bluechat-inbound/types.ts` (~70 linhas)
- `ChannelType`, `BlueChatPayload`, `TriageSummary`, `LeadContact`, `LeadCadenceRun`, `BlueChatResponse`

### Arquivo 2: `bluechat-inbound/schemas.ts` (~30 linhas)
- `blueChatSchema` (Zod schema atualmente inline no handler)

### Arquivo 3: `bluechat-inbound/auth.ts` (~40 linhas)
- `validateAuth()`

### Arquivo 4: `bluechat-inbound/contact-resolver.ts` (~220 linhas)
- `normalizePhone()`, `extractFirstName()`
- `generatePhoneVariations()`
- `findLeadByPhone()`
- `createLead()`
- `findActiveRun()`, `isDuplicate()`

### Arquivo 5: `bluechat-inbound/triage.ts` (~100 linhas)
- `parseTriageSummary()`
- `enrichLeadFromTriage()`

### Arquivo 6: `bluechat-inbound/message-handler.ts` (~70 linhas)
- `saveInboundMessage()`

### Arquivo 7: `bluechat-inbound/sdr-bridge.ts` (~80 linhas)
- `callSdrIaInterpret()`

### Arquivo 8: `bluechat-inbound/callback.ts` (~110 linhas)
- `sendResponseToBluechat()`

### Resultado: `bluechat-inbound/index.ts` (~400 linhas)
- Imports + `serve()` handler com fluxo orquestrado
- Rate limiting, auth, Zod parse, lead lookup/create, mirror, deal auto-create, triage, message save, SDR IA call, anti-limbo logic, response build, callback

---

## Detalhes Tecnicos

### Import/Export
- Cada modulo usa `export function` / `export type` / `export const`
- `index.ts` importa com: `import { validatePayload, sgtPayloadSchema } from "./validation.ts";`
- Imports entre modulos do mesmo webhook sao permitidos (ex: `classification.ts` importa de `types.ts`)

### Dependencias externas (`_shared/`)
- Modulos que usam funcoes de `_shared/` importam diretamente (ex: `normalization.ts` importa de `../_shared/phone-utils.ts`)
- Modulos que usam `SupabaseClient` importam de `https://esm.sh/@supabase/supabase-js@2`

### O que NAO muda
- Nenhuma logica de negocio alterada
- Nenhum comportamento HTTP alterado
- Nenhuma assinatura de funcao alterada
- O `serve()` handler mantem exatamente o mesmo fluxo

### Ordem de execucao
1. Criar todos os modulos de `sgt-webhook/` (types, validation, normalization, classification, cadence, auth)
2. Reescrever `sgt-webhook/index.ts` como orquestrador
3. Criar todos os modulos de `bluechat-inbound/` (types, schemas, auth, contact-resolver, triage, message-handler, sdr-bridge, callback)
4. Reescrever `bluechat-inbound/index.ts` como orquestrador
5. Deploy e teste das duas funcoes

### Risco
**Baixo**. Extracoes puramente mecanicas. O comportamento e identico — so muda a organizacao dos arquivos.

