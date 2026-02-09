

# Reorganizar Tela de Configuracoes

## Problema Atual

A tela tem 6 abas com sobreposicao de funcionalidade:
- "Integracoes" mostra cards de WhatsApp/Email com toggle e teste
- "WhatsApp" e "Email" sao abas separadas com detalhes dos mesmos canais
- "Geral" e generico demais (so configura a Amelia)
- SGT e Mensageria estao inativos, ocupando espaco sem necessidade

## Proposta: 4 Abas Reorganizadas

| Aba Atual | Nova Estrutura |
|-----------|---------------|
| Integracoes + WhatsApp + Email | **Canais e Integracoes** - tudo junto, cada canal com sua secao expandivel |
| IA | **IA** - mantida como esta |
| Geral | **Amelia** - renomear para deixar claro o proposito |
| Webhooks | **Webhooks** - mantida como esta |

### 1. Aba "Canais e Integracoes" (nova)

Unificar a visao. Cada integracao vira uma secao com:
- Header com toggle de ativacao, status e botao de teste (o que ja existe no IntegrationCard)
- Conteudo expandivel (Collapsible) com os detalhes especificos:
  - WhatsApp: modo teste, numero teste, estatisticas
  - Email: modo teste, email teste, estatisticas  
  - Pipedrive: configuracao de secrets
  - Anthropic: configuracao de secrets
  - SGT: configuracao de secrets (marcado como inativo)
  - Blue Chat / Mensageria: config por empresa (ja existe)

Assim o usuario ve tudo em um lugar so, sem precisar trocar de aba para configurar detalhes do mesmo canal.

### 2. Aba "Amelia" (renomear "Geral")

Trocar o nome de "Geral" para "Amelia" com icone Bot, deixando claro que configura o comportamento da IA conversacional. Conteudo permanece identico (horario, limites, tom).

### 3. Remover abas "WhatsApp" e "Email"

O conteudo sera absorvido pela aba "Canais e Integracoes" como secoes expandiveis dentro do card de cada canal.

### 4. Reduzir para 4 abas

De 6 para 4 abas: Canais, IA, Amelia, Webhooks. Melhora o layout em mobile (grid-cols-4 em vez de 6).

## Secao Tecnica

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/admin/Settings.tsx` | Reduzir de 6 para 4 abas, renomear |
| `src/components/settings/IntegrationsTab.tsx` | Refatorar para incluir detalhes inline (expandiveis) de WhatsApp e Email |
| `src/components/settings/IntegrationCard.tsx` | Adicionar suporte a conteudo expandivel (children) via Collapsible |

### Arquivos removidos (conteudo absorvido)

| Arquivo | Destino |
|---------|---------|
| `src/components/settings/WhatsAppDetailsTab.tsx` | Conteudo movido para dentro do IntegrationCard de WhatsApp |
| `src/components/settings/EmailDetailsTab.tsx` | Conteudo movido para dentro do IntegrationCard de Email |

### Estrutura do IntegrationCard expandivel

O IntegrationCard ganhara um prop opcional `children` e usara o componente Collapsible do Radix UI. Quando o card tem detalhes, um botao "Detalhes" aparece e expande a area abaixo do card header.

### Settings.tsx simplificado

```text
Tabs (4):
  - "channels"  -> Plug icon  -> "Canais"     -> IntegrationsTab (com detalhes inline)
  - "ai"        -> Brain icon  -> "IA"         -> AISettingsTab
  - "amelia"    -> Bot icon    -> "Amélia"     -> GeneralTab (renomeado visualmente)
  - "webhooks"  -> Webhook icon -> "Webhooks"  -> WebhooksTab
```

