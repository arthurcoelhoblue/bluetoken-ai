

## Diagnóstico: Erro falso de janela 24h

**Causa raiz**: O campo `last_inbound_at` está `NULL` no `lead_conversation_state` do Arthur Coelho, apesar de existirem mensagens INBOUND recentes (22:07, 22:08). O `whatsapp-send` interpreta NULL como "infinitas horas atrás" e bloqueia o envio.

Isso aconteceu porque o upsert do `meta-webhook` que atualiza `last_inbound_at` provavelmente falhou silenciosamente (possivelmente relacionado à duplicação de leads que corrigimos antes — o lead original pode não ter tido o `last_inbound_at` propagado).

## Correções

### 1. Corrigir dado imediato
- UPDATE direto no `lead_conversation_state` para setar `last_inbound_at` com o timestamp da última mensagem INBOUND real

### 2. Tornar meta-webhook resiliente
- No `meta-webhook/index.ts`, após o upsert de `last_inbound_at`, checar o resultado e logar erro se falhar
- Adicionar fallback: se o upsert falhar, tentar `.update()` direto

### 3. Adicionar fallback no `update_conversation_with_intent`
- Na função RPC `update_conversation_with_intent`, incluir `last_inbound_at = NOW()` no update quando a mensagem processada for inbound (detectável por parâmetro adicional)
- Isso garante que mesmo se o meta-webhook falhar, o sdr-ia-interpret atualize o campo

### 4. Tratar NULL como "sem restrição" no whatsapp-send
- No `whatsapp-send`, quando `last_inbound_at` é NULL mas `ultimo_contato_em` é recente (< 24h), usar `ultimo_contato_em` como fallback ao invés de tratar como Infinity

### Arquivos afetados
- `supabase/functions/meta-webhook/index.ts` — log de erro no upsert
- `supabase/functions/whatsapp-send/index.ts` — fallback para `ultimo_contato_em` quando `last_inbound_at` é NULL
- Migração SQL — corrigir dado atual e adicionar lógica no RPC

