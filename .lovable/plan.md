

## Patch 7: Edge Functions — Copilot IA + SDR Modo Manual

### Resumo

Substituir o mock do Copilot Amelia por uma edge function real que enriquece contexto com dados do CRM e chama a IA via Lovable AI Gateway. Tambem consolida a tipagem do modo MANUAL no sdr-ia-interpret.

---

### O que ja existe vs o que precisa ser feito

| Item | Status atual | Acao |
|------|-------------|------|
| CopilotPanel UI | Mock com setTimeout | Conectar a edge function real |
| SDR modo MANUAL | Implementado (linha 4298) | Apenas tipar — remover `as any` |
| ConversationState.modo | Falta no tipo (linha 102-115) | Adicionar campos modo/assumido |
| MANUAL_MODE no LeadIntentTipo | Nao existe (linha 29-46) | Adicionar ao enum |
| copilot-chat edge function | Nao existe | Criar |
| LOVABLE_API_KEY | Configurado | Pronto para uso |

---

### Ordem de implementacao

#### Fase 1: Edge Function `copilot-chat`

Criar `supabase/functions/copilot-chat/index.ts`:

- CORS headers padrao
- Recebe: `messages`, `contextType`, `contextId`, `empresa`
- Enriquecimento por tipo de contexto:
  - **LEAD**: classificacao + ultimas 15 mensagens + estado conversa + framework data
  - **DEAL**: deal completo via `deals_full_detail` + 10 atividades recentes
  - **PIPELINE/GERAL**: resumo pipelines + SLA estourados
- Chama Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Retorna: `{ content, model, tokens_input, tokens_output, latency_ms }`
- Erros tratados: 429, 402, 500

Registrar no `supabase/config.toml`:
```text
[functions.copilot-chat]
verify_jwt = false
```

System prompt da Amelia:
```text
Voce e a Amelia, consultora de vendas IA do Blue CRM.
Ajude vendedores com insights diretos e actionaveis baseados nos dados do CRM.
Responda em portugues. Nao invente dados — use apenas o contexto fornecido.
```

#### Fase 2: SDR-IA-Interpret — Consolidar tipagem

No `supabase/functions/sdr-ia-interpret/index.ts`:

1. Adicionar `'MANUAL_MODE'` ao tipo `LeadIntentTipo` (linha 46)
2. Adicionar ao `ConversationState` (linhas 102-115):
   - `modo?: 'SDR_IA' | 'MANUAL' | 'HIBRIDO'`
   - `assumido_por?: string | null`
   - `assumido_em?: string | null`
   - `devolvido_em?: string | null`
3. Remover cast `as any` na linha 4298

#### Fase 3: CopilotPanel — Conectar ao backend

Modificar `src/components/copilot/CopilotPanel.tsx`:

- Remover setTimeout mock (linhas 63-71)
- Chamar `supabase.functions.invoke('copilot-chat', { body })`
- Passar historico, contextType, contextId, empresa
- Toast de erro para falhas 429/402
- Mensagem inline para erros genericos

---

### Secao tecnica

**Modelo IA**: `google/gemini-3-flash-preview` via Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)

**Autenticacao**: `LOVABLE_API_KEY` ja configurada (secret do projeto)

**Arquivos criados/modificados**:

| Arquivo | Acao |
|---------|------|
| `supabase/functions/copilot-chat/index.ts` | Criar |
| `supabase/functions/sdr-ia-interpret/index.ts` | Editar (3 pontos) |
| `src/components/copilot/CopilotPanel.tsx` | Editar (remover mock, conectar backend) |

**Decisao vs PDF**: O PDF sugere Claude Sonnet + Gemini fallback, mas usaremos Lovable AI Gateway (gemini-3-flash-preview) que ja esta disponivel sem API key extra e e o padrao do projeto.

---

### Checklist de validacao

1. copilot-chat edge function criada e deployada
2. Teste curl: POST copilot-chat com contextType=GERAL retorna resposta IA
3. CopilotPanel chama backend real
4. Resposta da Amelia aparece no painel
5. Enriquecimento LEAD funciona (classificacao + mensagens)
6. Enriquecimento DEAL funciona (deal + atividades)
7. SDR-IA: MANUAL_MODE adicionado ao tipo
8. SDR-IA: ConversationState tipado corretamente
9. SDR-IA: cast `as any` removido
10. Erros 429/402 exibidos como toast

