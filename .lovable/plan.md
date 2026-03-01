

# Ensinar a Amélia a partir das Lacunas de Conhecimento

## Problema Atual
O componente `KnowledgeGaps` mostra o que a Amélia não soube responder (tópico, descrição, exemplos de perguntas), mas as únicas ações disponíveis são **ver exemplos** e **marcar como resolvida**. Não existe forma de fornecer a resposta correta diretamente a partir da lacuna.

## Solução
Adicionar um botão "Ensinar" em cada lacuna que abre um formulário inline (ou dialog) pré-preenchido com a pergunta da lacuna, onde o gestor digita a resposta correta. Ao salvar:
1. Cria uma FAQ aprovada automaticamente (admin) ou pendente (não-admin), usando o hook `useCreateFaq` existente
2. Marca a lacuna como `RESOLVIDO` automaticamente e vincula o `suggested_faq_id` (coluna já existente na tabela)

## Alterações

### 1. `KnowledgeGaps.tsx` — Adicionar fluxo "Ensinar"
- Adicionar estado para controlar qual gap está sendo respondido (`teachingGapId`)
- Quando o gestor clica no botão "Ensinar" (ícone `MessageSquarePlus` ou similar), expandir um formulário inline com:
  - **Pergunta** (pré-preenchida com `gap.topic`, editável)
  - **Resposta** (textarea vazio para o gestor preencher)
  - **Categoria** (select com `FAQ_CATEGORIAS`)
- Botão "Salvar e Ensinar" que:
  - Chama `useCreateFaq` com status `APROVADO` (se admin) ou `PENDENTE`
  - Atualiza a lacuna para `RESOLVIDO` com `suggested_faq_id` apontando para a FAQ criada
  - Invalida queries de gaps e FAQs
  - Exibe toast de sucesso

### 2. Nenhuma mudança de banco de dados
A coluna `suggested_faq_id` já existe em `knowledge_gaps`. A tabela `knowledge_faq` já suporta o fluxo. Nenhuma migration necessária.

### 3. Nenhuma mudança em edge functions
O fluxo usa hooks existentes (`useCreateFaq`) e mutations diretas no Supabase client.

## Detalhes Técnicos

O formulário inline dentro de cada gap card reutiliza a lógica de criação do `FaqFormDialog`, mas simplificada:
- Pré-preenche `pergunta` com `gap.topic`
- Se há `sample_queries`, mostra como referência para o gestor entender o contexto
- Após criar a FAQ, faz `update` na `knowledge_gaps` com `status: 'RESOLVIDO'` e `suggested_faq_id: novaFaqId`
- Usa `checkFaqAutoApproval` para admins ou envia como PENDENTE para não-admins (mesma lógica do `FaqFormDialog`)

