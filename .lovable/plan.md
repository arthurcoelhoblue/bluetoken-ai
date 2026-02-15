

# Correcao de Layout CS + Envio de Pesquisa em Massa

## Parte 1: Corrigir Layout das Paginas CS (sidebar + botao voltar)

Todas as 6 paginas CS estao renderizando sem `AppLayout`, por isso nao tem sidebar nem TopBar. A correcao e simples: envolver o conteudo de cada pagina com `<AppLayout>`.

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/cs/CSDashboardPage.tsx` | Importar `AppLayout`, envolver return com `<AppLayout>` |
| `src/pages/cs/CSClientesPage.tsx` | Idem |
| `src/pages/cs/CSClienteDetailPage.tsx` | Idem |
| `src/pages/cs/CSPesquisasPage.tsx` | Idem |
| `src/pages/cs/CSIncidenciasPage.tsx` | Idem |
| `src/pages/cs/CSPlaybooksPage.tsx` | Idem |

### Padrao a seguir (mesmo das outras paginas)

```typescript
import { AppLayout } from '@/components/layout/AppLayout';

export default function CSIncidenciasPage() {
  return (
    <AppLayout>
      <div className="flex-1 overflow-auto">
        {/* conteudo existente */}
      </div>
    </AppLayout>
  );
}
```

### Registrar rotas CS no TopBar

Adicionar titulos em `src/components/layout/TopBar.tsx` no objeto `ROUTE_TITLES`:

```typescript
'/cs': 'Dashboard CS',
'/cs/clientes': 'Clientes CS',
'/cs/pesquisas': 'Pesquisas CS',
'/cs/incidencias': 'Incidencias CS',
'/cs/playbooks': 'Playbooks CS',
```

---

## Parte 2: Envio de Pesquisa CS em Massa pela Amelia

### Objetivo

Permitir que o CSM selecione multiplos clientes CS e dispare pesquisas (NPS ou CSAT) em lote, usando a mesma logica da tela de Acao em Massa da Amelia.

### Nova pagina: `src/pages/cs/CSPesquisaMassaPage.tsx`

Uma tela dedicada com:

1. **Filtros de selecao de clientes**:
   - Health Status (Saudavel, Atencao, Em Risco, Critico)
   - NPS Categoria (Promotor, Neutro, Detrator)
   - CSM responsavel
   - Periodo sem pesquisa (30, 60, 90+ dias)
   - Busca por nome

2. **Tabela de clientes** com colunas:
   - Nome, Health Score, Ultimo NPS, Ultimo CSAT, CSM, Ultimo contato
   - Checkbox de selecao (individual + selecionar todos)

3. **Painel de acao**:
   - Tipo de pesquisa: NPS ou CSAT
   - Canal: WhatsApp ou Email (baseado no dado disponivel)
   - Botao "Enviar para X selecionados"
   - Preview da mensagem que sera enviada

4. **Execucao**:
   - Chama a edge function `cs-nps-auto` para cada cliente selecionado
   - Progresso visual (barra + contador)
   - Resultado final (enviados com sucesso / falhas)

### Hook: `src/hooks/useCSMassSurvey.ts`

```typescript
// Busca clientes elegiveis com filtros
// Dispara envio em lote chamando cs-nps-auto por cliente
// Retorna progresso e resultado
```

### Rota e navegacao

- Rota: `/cs/pesquisas/massa`
- Link na pagina de Pesquisas CS (botao "Envio em Massa")
- Registrar no `App.tsx` e `TopBar.tsx`
- Adicionar item no menu lateral (AppSidebar) dentro do grupo CS

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/cs/CSPesquisaMassaPage.tsx` | Criar - pagina principal |
| `src/hooks/useCSMassSurvey.ts` | Criar - logica de selecao e envio |
| `src/App.tsx` | Adicionar rota `/cs/pesquisas/massa` |
| `src/components/layout/TopBar.tsx` | Adicionar titulo da rota CS + massa |
| `src/components/layout/AppSidebar.tsx` | Verificar se ja tem link, adicionar se nao |
| `src/pages/cs/CSPesquisasPage.tsx` | Adicionar botao "Envio em Massa" |

### Detalhes tecnicos

A edge function `cs-nps-auto` ja suporta envio individual (com `customer_id` no body). Para o envio em massa, o hook fara chamadas sequenciais (com throttle de 500ms entre cada) para evitar sobrecarga:

```typescript
async function sendBulkSurveys(customerIds: string[], tipo: 'NPS' | 'CSAT') {
  const results = [];
  for (const id of customerIds) {
    const res = await supabase.functions.invoke('cs-nps-auto', {
      body: { customer_id: id, tipo }
    });
    results.push({ id, success: !res.error });
    await new Promise(r => setTimeout(r, 500)); // throttle
  }
  return results;
}
```

