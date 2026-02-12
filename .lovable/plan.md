

# Atualizar Shell Pages e PageShell com versoes refinadas

## Resumo

Atualizar as 9 paginas shell e o componente PageShell para usar os conteudos refinados enviados pelo usuario. As mudancas sao cosmeticas: novos icones, descricoes mais detalhadas e renomeacao da prop `patchLabel` para `patchInfo`.

## Mudancas

### 1. `src/components/layout/PageShell.tsx`
- Renomear prop `patchLabel` para `patchInfo` (alinhando com os arquivos enviados)

### 2. Atualizar 9 paginas shell
Cada pagina recebe o conteudo exato enviado nos arquivos:

| Pagina | Icone anterior | Icone novo | Descricao atualizada |
|--------|---------------|------------|---------------------|
| PipelinePage | Columns3 | Kanban | Kanban visual com drag-and-drop... |
| ContatosPage | ContactRound | Users | Visao unificada de pessoas... |
| ConversasPage | MessagesSquare | MessageSquare | Chat unificado WhatsApp e Email... |
| MetasPage | Target | Target (sem mudanca) | Comissao acumulada em tempo real... |
| RenovacaoPage | RefreshCcw | Repeat | Pipeline separado de renovacao... |
| CockpitPage | Gauge | BarChart3 | Visao gerencial em 30 segundos... |
| AmeliaPage | Bot (sem mudanca) | Bot | Central de operacoes da SDR IA... |
| TemplatesPage | FileText (sem mudanca) | FileText | Biblioteca de templates... |
| IntegracoesPage | Plug | Webhook | Status e configuracao de SGT... |

### 3. Impacto
- Zero impacto em rotas, layout, edge functions ou banco
- Apenas visual: textos e icones das paginas placeholder

