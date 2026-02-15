
# Correcao: "useCompany must be used within CompanyProvider"

## Causa Raiz

O `CompanyProvider` esta posicionado DENTRO do `AppLayout` (linha 36 de `AppLayout.tsx`). Isso cria dois problemas:

1. **Paginas que usam `AppLayout` mas chamam `useCompany` no corpo do componente** (antes de renderizar `AppLayout`): os hooks rodam antes do `CompanyProvider` existir na arvore React.
   - `MetasPage` (linha 35: `useCompany()`)
   - `AmeliaMassActionPage` (linha 53: `useCompany()`)
   - `AnalyticsExecutivoPage` (linha 27: `useCompany()`)

2. **Paginas do modulo CS que NAO usam `AppLayout`**: usam apenas `PageShell` (que e um componente visual simples, sem providers). Os hooks internos (`useCSMetrics`, `useCSSurveys`, `useCSIncidents`, `useCSCustomers`, `useCSPlaybooks`) todos chamam `useCompany()` internamente, mas nao ha `CompanyProvider` na arvore.
   - `CSDashboardPage`
   - `CSClientesPage`
   - `CSClienteDetailPage`
   - `CSPesquisasPage`
   - `CSIncidenciasPage`
   - `CSPlaybooksPage`

**Total: 9 paginas quebradas** pelo mesmo motivo.

---

## Solucao

Mover o `CompanyProvider` de dentro do `AppLayout` para o `App.tsx`, no nivel global, envolvendo todas as rotas protegidas. Isso garante que QUALQUER componente filho tenha acesso ao contexto de empresa, independente de usar `AppLayout` ou nao.

### Alteracao 1: `src/App.tsx`

Importar `CompanyProvider` e envolver todo o bloco de rotas dentro de `AuthProvider`:

```text
<AuthProvider>
  <CompanyProvider>      <-- NOVO: movido pra ca
    <ErrorBoundary>
      <Suspense>
        <Routes>...</Routes>
      </Suspense>
    </ErrorBoundary>
  </CompanyProvider>
</AuthProvider>
```

### Alteracao 2: `src/components/layout/AppLayout.tsx`

Remover o `CompanyProvider` do `AppLayout`, pois ja esta no nivel superior. O `ThemeProvider` permanece.

```text
// Antes:
<ThemeProvider>
  <CompanyProvider>
    <SidebarProvider>...</SidebarProvider>
  </CompanyProvider>
</ThemeProvider>

// Depois:
<ThemeProvider>
  <SidebarProvider>...</SidebarProvider>
</ThemeProvider>
```

---

## Impacto

- **Zero mudanca de comportamento**: o `CompanyProvider` continua usando `localStorage` para persistir a empresa ativa
- **9 paginas corrigidas de uma vez**: MetasPage, AmeliaMassActionPage, AnalyticsExecutivoPage, e todas as 6 paginas do modulo CS
- **Prevencao futura**: qualquer nova pagina ou hook que use `useCompany` funcionara automaticamente, sem precisar se preocupar com `AppLayout`

## Arquivos editados

1. `src/App.tsx` -- adicionar `CompanyProvider` envolvendo as rotas
2. `src/components/layout/AppLayout.tsx` -- remover `CompanyProvider` (evitar duplicacao)
