

## Plano: Melhorar erro de 24h e adicionar seletor de templates

### Problema atual
Quando a janela de 24h da Meta expira, o `whatsapp-send` retorna `"Janela de 24h expirada. Envie um template aprovado para reabrir a conversa."` — mas o UI apenas exibe um toast genérico sem ação possível para o usuário.

### Mudanças

**1. Criar componente `TemplatePickerDialog`**
- Novo arquivo: `src/components/conversas/TemplatePickerDialog.tsx`
- Dialog que lista templates aprovados (`meta_status = 'APPROVED'`, `ativo = true`) da empresa ativa
- Mostra preview do conteúdo do template
- Botão "Enviar Template" que invoca `whatsapp-send` com `metaTemplateName`, `metaLanguage`, e `metaComponents`
- Campos de variáveis dinâmicos se o template tiver `variaveis`

**2. Atualizar `ManualMessageInput`**
- Detectar erro de janela 24h no retorno do `useSendManualMessage` (checar `error.message` contendo "Janela de 24h" ou "24h")
- Quando detectado, exibir um banner inline (não apenas toast) com:
  - Mensagem clara: "A janela de conversa expirou. Para reabrir, envie um template aprovado."
  - Botão "Selecionar Template" que abre o `TemplatePickerDialog`
- Desabilitar input de texto livre enquanto banner estiver ativo

**3. Atualizar `useSendManualMessage` (hook)**
- Propagar o erro completo (não apenas `message`) para que o componente consiga distinguir erros de 24h de erros genéricos

**4. Adicionar botão de template ao lado do input**
- Ícone de template (FileText) permanente ao lado do botão Send
- Permite enviar templates mesmo dentro da janela de 24h (útil para mensagens padronizadas)

### Fluxo do usuário
```text
Usuário digita mensagem → Envia → Erro 24h
                                    ↓
                          Banner: "Janela expirada"
                          [Selecionar Template]
                                    ↓
                          Dialog com templates aprovados
                          Usuário escolhe → Preenche variáveis → Envia
                                    ↓
                          Template enviado via whatsapp-send
```

### Arquivos afetados
- `src/components/conversas/TemplatePickerDialog.tsx` (novo)
- `src/components/conversas/ManualMessageInput.tsx` (atualizado)
- `src/hooks/useConversationMode.ts` (ajuste menor no error handling)

