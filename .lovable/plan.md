

# Frente 3: Testes para ai-provider + SDR modules

A migracao para `callAI()` esta completa (18 funcoes usam o wrapper). Rate limiting esta implementado. Resta apenas criar os testes.

---

## Status atual

| Item | Status |
|------|--------|
| CRON Jobs | Resolvido (16 jobs ativos) |
| Rate Limiting enforced | Resolvido (checkRateLimit em callAI) |
| Migracao callAI() | Resolvido (18/18 funcoes AI migradas) |
| Testes SDR + ai-provider | **Pendente** - 0 testes para edge functions |

---

## Testes a criar

### 1. `src/hooks/__tests__/aiProvider.test.ts` — Logica do ai-provider

Testar as funcoes de custo e rate limiting extraindo a logica testavel:

- **COST_TABLE**: Verificar que calculo de custo para Claude, Gemini e GPT-4o retorna valores corretos (ex: 1000 tokens input Claude = $0.003)
- **Rate limit logic**: Verificar que limite de 60/h para copilot-chat e 200/h para sdr-intent-classifier estao corretos
- **Default limit**: Verificar que funcoes nao mapeadas usam 100/h

### 2. `src/hooks/__tests__/sdrIntentClassifier.test.ts` — Logica do SDR Classifier

Testar as funcoes puras exportaveis do classifier:

- **computeClassificationUpgrade**: 
  - Lead QUENTE + INTERESSE_IR confianca 1.0 retorna P1, ICP BLUE_ALTO_TICKET_IR
  - Lead MORNO + DUVIDA_PRECO confianca 0.75 retorna P2
  - Origem MANUAL nao e sobrescrita (retorna objeto vazio)
  - Lead FRIO + intent baixa confianca nao muda nada

- **computeNewTemperature**:
  - FRIO + INTERESSE_COMPRA sobe para MORNO
  - MORNO + INTERESSE_IR sobe para QUENTE
  - QUENTE + OPT_OUT desce para MORNO

- **detectarLeadQuenteImediato**:
  - "quero contratar" retorna detectado=true, tipo=DECISAO_TOMADA, confianca=ALTA
  - "malha fina" retorna URGENCIA_TEMPORAL
  - "ola bom dia" retorna detectado=false

- **decidirProximaPergunta**:
  - BLUE sem SPIN.S retorna SPIN_S
  - BLUE com S+P + intent INTERESSE_IR retorna CTA_REUNIAO
  - TOKENIZA sem GPCT.G retorna GPCT_G

### 3. `src/hooks/__tests__/sdrMessageParser.test.ts` — Parser de mensagens

- **detectarLeadQuenteImediato** (duplicada no parser, mesma logica):
  - Testa urgencia com frases reais de leads
  
- **inferirPerfilInvestidor**:
  - Mensagem com "seguranca" retorna CONSERVADOR
  - Mensagem com "rentabilidade" retorna ARROJADO
  - DISC D sem keywords retorna ARROJADO
  - DISC C sem keywords retorna CONSERVADOR

- **detectCrossCompanyInterest**:
  - Lead BLUE mencionando "investimento" detecta interesse TOKENIZA
  - Lead TOKENIZA mencionando "imposto de renda" detecta interesse BLUE

### 4. `src/hooks/__tests__/sdrActionExecutor.test.ts` — Logica de acoes

- **Classification upgrade**: Verificar que campos com valor null nao sao incluidos no update
- **Opt-out flow**: Verificar que OPT_OUT cancela todas cadencias ativas (logica testavel)

---

## Abordagem tecnica

Como as funcoes de edge sao Deno e nao podem rodar no Vitest diretamente, vamos **extrair as funcoes puras** (que nao dependem de Supabase/fetch) e testa-las como modulos TypeScript no ambiente Vitest existente.

As funcoes a extrair sao puramente logicas:
- `computeClassificationUpgrade`
- `computeNewTemperature`
- `detectarLeadQuenteImediato`
- `decidirProximaPergunta`
- `inferirPerfilInvestidor`
- `detectCrossCompanyInterest`

Sera criado um arquivo `src/lib/sdr-logic.ts` com essas funcoes (copy das edge functions) para poder testar no Vitest. Isso nao duplica codigo de producao — serve como contrato de validacao da logica.

---

## Arquivos a criar

| Arquivo | Conteudo |
|---------|---------|
| `src/lib/sdr-logic.ts` | Funcoes puras extraidas do SDR (computeClassificationUpgrade, etc) |
| `src/lib/__tests__/sdr-logic.test.ts` | ~15 testes cobrindo toda logica SDR |
| `src/lib/__tests__/ai-provider-logic.test.ts` | ~5 testes cobrindo custos e rate limits |

Total: ~20 testes novos, cobertura completa da logica de negocios SDR + AI.

