

# Corrigir RLS de `lead_conversation_state` para permitir takeover

## Problema

A tabela `lead_conversation_state` nao tem policy de UPDATE para usuarios autenticados. Apenas `service_role` e o role `SDR_IA` podem modificar registros. Quando um ADMIN ou VENDEDOR clica em "Devolver a Amelia", o PATCH retorna 204 mas 0 linhas sao atualizadas, deixando o lead permanentemente em modo MANUAL.

## Correcao

### Etapa 1: Criar migration com nova RLS policy

Adicionar uma policy que permite UPDATE para usuarios autenticados na propria empresa:

```sql
CREATE POLICY "Authenticated users can update conversation_state in own empresa"
ON public.lead_conversation_state
FOR UPDATE
TO authenticated
USING (
  (empresa::text = ANY (get_user_empresas(auth.uid())))
)
WITH CHECK (
  (empresa::text = ANY (get_user_empresas(auth.uid())))
);
```

### Etapa 2: Corrigir o estado do Arthur Coelho manualmente

Executar via migration para devolver o lead ao modo SDR_IA (ja que a acao anterior falhou silenciosamente):

```sql
UPDATE lead_conversation_state
SET modo = 'SDR_IA',
    assumido_por = NULL,
    devolvido_em = NOW(),
    updated_at = NOW()
WHERE lead_id = '3c6f90e1-194f-4c69-b0d8-e5c3a7ddfaf8'
  AND empresa = 'BLUE';
```

### Etapa 3: Verificar se `conversation_takeover_log` tem o mesmo problema

A tabela `conversation_takeover_log` recebeu INSERT com sucesso (201), entao a policy de INSERT ja funciona. Confirmar que nao ha gaps similares.

## Arquivos alterados

Nenhum arquivo de codigo precisa mudar. O hook `useConversationTakeover` ja faz o PATCH corretamente — o problema e exclusivamente de permissao no banco.

## Resultado esperado

Apos a migration, o botao "Devolver a Amelia" vai efetivamente alterar o `modo` para `SDR_IA`, e a Amelia retomara o atendimento automatico quando o lead enviar a proxima mensagem.

