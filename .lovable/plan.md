

# Diagnóstico dos 2 Erros

## Erro 1: Sincronização Meta (PATCH)

**Causa**: Em `src/hooks/useTemplates.ts` linhas 133-154, o `useSyncMetaTemplates()` faz **duas requisições**:
1. `supabase.functions.invoke('whatsapp-template-manager', { method: 'PATCH' })` — SEM o parâmetro `empresa` → retorna 400 ("empresa query param required")
2. Uma segunda `fetch()` manual COM `empresa` — essa deveria funcionar, mas a primeira já dispara o erro

A primeira chamada na linha 134 é desnecessária e causa o erro. Basta remover essa chamada e manter apenas o `fetch` manual das linhas 146-154.

## Erro 2: Indexação base de conhecimento (knowledge-embed)

**Causa**: A function `knowledge-embed` não gera logs, o que indica que ela **não está deployada** ou está falhando no boot. O código existe em `supabase/functions/knowledge-embed/index.ts`, mas essa function não está registrada no `supabase/config.toml` com `verify_jwt = false`, o que pode estar bloqueando a chamada autenticada.

A secret `OPENAI_API_KEY` existe, então o problema não é de credenciais.

## Plano de Correção

### 1. Corrigir `useSyncMetaTemplates` em `src/hooks/useTemplates.ts`
- Remover a chamada duplicada `supabase.functions.invoke(...)` na linha 134-138
- Manter apenas o `fetch` manual que já inclui `empresa` como query param

### 2. Registrar `knowledge-embed` no `supabase/config.toml`
- Adicionar `[functions.knowledge-embed]` com `verify_jwt = false`
- Isso garantirá o deploy e acesso correto da function

