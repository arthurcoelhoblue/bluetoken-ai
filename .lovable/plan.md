

## Diagnóstico

O preview está mostrando uma **página branca sem erros** no console. A investigação revelou:

1. O HTML (`index.html`) carrega normalmente
2. Os scripts de infraestrutura do Vite (`@vite/client`, `@react-refresh`) carregam com sucesso
3. O **`src/main.tsx` nunca é servido** — o servidor Vite não entrega o entry point da aplicação
4. Não há erros de compilação ou runtime no console

Isso indica um **problema transiente do servidor de desenvolvimento Vite**, não um bug no código. Os arquivos editados (`ConnectionPicker.tsx`, `ManualMessageInput.tsx`, `TemplatePickerDialog.tsx`, `useConversationMode.ts`) estão sintaticamente corretos e não causam erros de build.

## Solução

Este problema requer um **restart do servidor de desenvolvimento**. Clique no botão **"Restart"** (ícone ao lado do refresh) no topo do preview para reiniciar o Vite dev server. Um simples refresh da página não resolve porque o servidor já está em estado inconsistente.

Se o restart não funcionar, tente restaurar para a versão anterior pelo histórico e reaplicar as mudanças.

