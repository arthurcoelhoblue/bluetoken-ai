

# Copilot contextual na TopBar -- detectar rota automaticamente

## Problema

O CopilotPanel na TopBar sempre usa `type: 'GERAL'` sem `contextId`. Quando o usuario esta na pagina de um lead (`/leads/:id/:empresa`), deal, ou cliente CS, o Copilot nao tem acesso aos dados especificos daquela entidade.

## Solucao

Modificar a TopBar para extrair automaticamente o contexto da rota atual usando `useLocation` + `useParams` (ou parsing manual do pathname). O backend ja tem todas as funcoes de enriquecimento prontas (`enrichLeadContext`, `enrichDealContext`, `enrichCustomerContext`, `enrichPipelineContext`) -- so precisa receber o `contextType` e `contextId` corretos.

## Mudanca

### Arquivo: `src/components/layout/TopBar.tsx`

Adicionar uma funcao `getContextFromRoute(pathname)` que retorna `{ type, id?, leadNome?, estadoFunil? }` baseado na rota:

| Rota | Contexto |
|------|----------|
| `/leads/:leadId/:empresa` | `type: 'LEAD', id: leadId` |
| `/pipeline` | `type: 'PIPELINE'` |
| `/cs/clientes/:id` | `type: 'CUSTOMER', id: customerId` |
| `/conversas` | `type: 'GERAL'` (conversas nao tem ID unico) |
| Qualquer outra rota | `type: 'GERAL'` |

A funcao faz parsing simples do pathname (split por `/`) para extrair IDs sem precisar de `useParams` (que so funciona dentro da rota especifica).

O CopilotPanel na TopBar passara a receber o contexto dinamico em vez do fixo `GERAL`.

## Detalhamento tecnico

1. Criar funcao `getCopilotContext(pathname: string, empresa: string)`:

```text
function getCopilotContext(pathname, empresa) {
  // /leads/:leadId/:empresa
  const leadMatch = pathname.match(/^\/leads\/([^/]+)\/([^/]+)$/);
  if (leadMatch) return { type: 'LEAD', id: leadMatch[1], empresa: leadMatch[2] };

  // /cs/clientes/:customerId
  const csMatch = pathname.match(/^\/cs\/clientes\/([^/]+)$/);
  if (csMatch) return { type: 'CUSTOMER', id: csMatch[1], empresa };

  // /pipeline
  if (pathname === '/pipeline') return { type: 'PIPELINE', empresa };

  // fallback
  return { type: 'GERAL', empresa };
}
```

2. Substituir a linha 98 (context fixo) pelo contexto dinamico:

```text
// Antes:
<CopilotPanel context={{ type: 'GERAL', empresa: activeCompany }} variant="icon" />

// Depois:
const copilotCtx = getCopilotContext(location.pathname, activeCompany);
<CopilotPanel context={copilotCtx} variant="icon" />
```

## Resultado esperado

- Na pagina `/leads/59359ed2.../BLUE`: Copilot abre com contexto LEAD, carrega classificacao, mensagens, intents, contato, organizacao do Marcos Bertoldi
- Na pagina `/pipeline`: Copilot abre com contexto PIPELINE, mostra resumo de deals e SLA
- Na pagina `/cs/clientes/:id`: Copilot abre com contexto CUSTOMER, mostra health score, incidencias, MRR
- Em qualquer outra pagina: comportamento atual (GERAL) com deals do vendedor, metas, tarefas

Apenas 1 arquivo modificado: `src/components/layout/TopBar.tsx`
