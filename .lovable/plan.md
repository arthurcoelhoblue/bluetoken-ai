
# Corrigir feedback do teste de e-mail

## Problema

Quando o "Modo Teste" esta ativo, a edge function `email-send` simula o envio sem conectar ao SMTP. Ela retorna `success: true` com um `messageId` falso (`test-{timestamp}`). O frontend exibe "E-mail de teste enviado!" sem informar que foi apenas uma simulacao -- dando a impressao de que o SMTP esta funcionando mesmo sem senha configurada.

## Solucao

### 1. Edge function: retornar flag `simulated` na resposta

Alterar `supabase/functions/email-send/index.ts` para incluir `simulated: true` no JSON de resposta quando o modo teste esta ativo:

```json
{ "success": true, "messageId": "test-...", "simulated": true }
```

### 2. Frontend: diferenciar envio real de simulado

Alterar `src/pages/EmailSmtpConfigPage.tsx`:

- Ler o campo `simulated` da resposta da edge function
- Se `simulated === true`, exibir toast de aviso (amarelo): **"Envio simulado (modo teste ativo)"** com descricao "Nenhum e-mail foi enviado de fato. Desative o modo teste para enviar de verdade."
- Se `simulated === false/undefined`, manter o toast verde de sucesso atual

### 3. Validacao pre-envio no frontend

Antes de chamar a edge function, verificar se os campos essenciais do SMTP estao preenchidos (host e porta). Se estiverem vazios, exibir toast de erro: **"Configure o SMTP antes de enviar"** e nao fazer a chamada.

Isso nao valida a senha (que e um secret do backend), mas ja evita envios quando a config minima nao existe.

## Arquivos alterados

- `supabase/functions/email-send/index.ts` -- adicionar `simulated: true` na resposta do modo teste
- `src/pages/EmailSmtpConfigPage.tsx` -- diferenciar toast por tipo de resposta e adicionar validacao pre-envio

## Resultado esperado

- Com modo teste ativo: toast amarelo "Envio simulado" 
- Com modo teste desativado e SMTP configurado: toast verde "E-mail enviado"
- Sem SMTP configurado: toast vermelho "Configure o SMTP antes de enviar"
