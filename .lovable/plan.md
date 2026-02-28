

# Diagnose: Botão "Ligar" sem efeito

## Causa raiz

A tabela `zadarma_config` tem `empresas_ativas = ['BLUE_LABS']`. TOKENIZA **nao** esta na lista.

Quando o usuario clica "Ligar", `handleDial` chama `proxy.mutate()` que invoca a edge function `zadarma-proxy`. A edge function verifica se a empresa esta em `empresas_ativas` e retorna **403** porque TOKENIZA nao esta la. O codigo trata esse erro com `onError: () => setPhoneState('idle')` — sem nenhum toast ou feedback visual, dando a impressao de que "nada acontece".

## Correcoes

### 1. Adicionar TOKENIZA e BLUE a `empresas_ativas`
- SQL: `UPDATE zadarma_config SET empresas_ativas = ARRAY['BLUE_LABS','TOKENIZA','BLUE'] WHERE id = 'fb9fd840-18db-4517-bf3f-72932b24ba11';`

### 2. Adicionar feedback de erro no `handleDial` (`ZadarmaPhoneWidget.tsx`)
- Importar `toast` de sonner
- No `onError` do `proxy.mutate`, exibir `toast.error('Erro ao iniciar chamada')` alem de resetar o estado
- Isso garante que o usuario veja feedback caso algo falhe no futuro

