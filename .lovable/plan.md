
# Chat com a Amélia no Menu Superior

## O que muda

Adicionar um botão de chat com a Amélia na TopBar, acessível de qualquer tela. O usuário conversa livremente sobre performance, ações, problemas — tudo dentro do contexto de trabalho dele.

## Segurança e Delimitação de Acesso

O controle funciona assim:
- O backend recebe o `user_id` do token JWT e consulta o perfil de acesso do usuário
- Os dados injetados no contexto da IA são filtrados pela empresa ativa do usuário
- Se o usuário não tem acesso a certos módulos (ex: CS, Pipeline), esses dados não são injetados
- A IA responde APENAS com base nos dados fornecidos — sem dados, sem resposta sobre o tema
- O system prompt reforça: "responda apenas com dados do contexto fornecido"

## Implementação

### 1. TopBar — Botão da Amélia

Adicionar o `CopilotPanel` no TopBar, entre a busca global e as notificações, com `variant="icon"` e contexto `GERAL`.

**Arquivo**: `src/components/layout/TopBar.tsx`
- Importar `CopilotPanel` e `useCompany`
- Renderizar `<CopilotPanel context={{ type: 'GERAL', empresa: activeCompany }} variant="icon" />` no header

### 2. Tipo `CopilotContextType` — Sem mudança

O tipo `GERAL` já existe em `src/types/conversas.ts`. Nenhuma alteração necessária.

### 3. Backend `copilot-chat` — Enriquecimento com filtro de acesso

**Arquivo**: `supabase/functions/copilot-chat/index.ts`

Mudanças na function:
- Extrair o `user_id` do token JWT da requisição (header Authorization)
- Consultar `user_access_assignments` + `access_profiles` para obter as permissões do usuário
- No `enrichGeralContext`, injetar dados **apenas dos módulos que o usuário pode visualizar**:
  - Se tem `pipeline:view` -> injetar resumo de pipelines e SLA
  - Se tem `leads:view` -> injetar contagem de leads ativos
  - Se tem `cs_dashboard:view` -> injetar resumo CS
  - Se tem `metas:view` -> injetar progresso de metas
- ADMINs recebem tudo (bypass)

### 4. Sugestões rápidas para contexto GERAL

**Arquivo**: `src/components/copilot/CopilotPanel.tsx`

Atualizar as sugestões do tipo `GERAL` para serem mais abrangentes:
- "Como está minha performance esta semana?"
- "Quais ações devo priorizar hoje?"
- "Dicas para melhorar minha taxa de conversão"
- "Resumo do meu pipeline atual"

---

## Detalhes Tecnicos

### Extração do user_id no backend

```text
Authorization: Bearer <jwt>
-> decodificar JWT com supabase.auth.getUser(token)
-> user_id
-> consultar permissoes
-> filtrar dados injetados
```

### Arquivos a editar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/TopBar.tsx` | Adicionar botao CopilotPanel com contexto GERAL |
| `src/components/copilot/CopilotPanel.tsx` | Melhorar sugestoes GERAL |
| `supabase/functions/copilot-chat/index.ts` | Extrair user_id, consultar permissoes, filtrar enriquecimento |

### Fluxo de segurança

1. Usuario clica no icone da Amelia no TopBar
2. Sheet abre com chat vazio + sugestoes
3. Usuario envia mensagem
4. Frontend chama `copilot-chat` com `contextType: GERAL`
5. Backend extrai JWT, identifica usuario
6. Backend consulta perfil de acesso do usuario
7. Backend injeta apenas dados dos modulos permitidos
8. IA responde com base apenas nos dados injetados
9. Se nao tem dados de um modulo, IA diz "nao tenho acesso a essas informacoes"
