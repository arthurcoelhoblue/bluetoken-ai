

# Fase D, Parte 2 — Decomposicao do bluechat-inbound

## Resumo

Extrair 7 modulos do `bluechat-inbound/index.ts` (1.507 linhas) sem alterar nenhuma logica de negocio. O `index.ts` ficara como orquestrador com ~400 linhas.

---

## Modulos a criar

### 1. `bluechat-inbound/types.ts` (~50 linhas)
Extrair das linhas 23-189:
- `ChannelType`, `BlueChatPayload`, `TriageSummary`, `LeadContact`, `LeadCadenceRun`, `BlueChatResponse`

### 2. `bluechat-inbound/schemas.ts` (~30 linhas)
Extrair das linhas 759-782:
- `blueChatSchema` (Zod schema inline no handler) — mover para export constante

### 3. `bluechat-inbound/auth.ts` (~40 linhas)
Extrair das linhas 210-246:
- `validateAuth()` — substituir `Deno.env.get` por `getOptionalEnv`
- Substituir `console.*` por `log.*`

### 4. `bluechat-inbound/contact-resolver.ts` (~220 linhas)
Extrair das linhas 198-449:
- `normalizePhone()`, `extractFirstName()`, `generatePhoneVariations()`
- `findLeadByPhone()`, `createLead()`, `findActiveRun()`, `isDuplicate()`
- Substituir `console.*` por `log.*`

### 5. `bluechat-inbound/triage.ts` (~100 linhas)
Extrair das linhas 67-144:
- `parseTriageSummary()`, `enrichLeadFromTriage()`

### 6. `bluechat-inbound/message-handler.ts` (~70 linhas)
Extrair das linhas 454-518:
- `saveInboundMessage()`

### 7. `bluechat-inbound/sdr-bridge.ts` (~80 linhas)
Extrair das linhas 523-599:
- `callSdrIaInterpret()` — substituir `Deno.env.get` por `envConfig`

### 8. `bluechat-inbound/callback.ts` (~120 linhas)
Extrair das linhas 604-726:
- `sendResponseToBluechat()` — substituir `Deno.env.get` por `getOptionalEnv`

---

## Resultado: `bluechat-inbound/index.ts` (~400 linhas)

Apenas:
- Imports dos 7 modulos + `_shared/`
- `serve()` handler com o fluxo orquestrado:
  - CORS, auth, Zod parse, rate limiting
  - Lead lookup/create, mirror cross-empresa
  - Deal auto-create
  - Triage detection + enrichment
  - Message save
  - SDR IA call
  - Anti-limbo logic + closing detection
  - Response build + callback
- Substituir `Deno.env.get` restantes por `envConfig`/`createServiceClient()`
- Substituir `console.*` por `log.*`

---

## Detalhes tecnicos

### Imports entre modulos
- `contact-resolver.ts` importa `LeadContact` de `./types.ts`
- `triage.ts` importa `TriageSummary`, `LeadContact` de `./types.ts` e `extractFirstName` de `./contact-resolver.ts`
- `message-handler.ts` importa `BlueChatPayload`, `LeadContact`, `LeadCadenceRun` de `./types.ts`
- `callback.ts` importa `EmpresaTipo` de `../_shared/types.ts`
- `sdr-bridge.ts` importa `TriageSummary` de `./types.ts` e `envConfig` de `../_shared/config.ts`

### O que NAO muda
- Nenhuma logica de negocio
- Nenhum comportamento HTTP
- Nenhuma assinatura de funcao
- O fluxo do `serve()` e identico

### Sequencia
1. Criar os 7 arquivos de modulo
2. Reescrever `index.ts` como orquestrador
3. Deploy e teste

### Risco
Baixo. Extracao puramente mecanica.

