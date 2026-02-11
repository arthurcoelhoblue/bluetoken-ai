

## Botao de Voltar Global

### O que muda
Adicionar um botao "Voltar" no header do `AppLayout.tsx`, ao lado do botao de menu (SidebarTrigger). O botao usara `useNavigate(-1)` do React Router para voltar a pagina anterior, e so aparecera quando houver historico de navegacao (ou seja, nao aparece na pagina inicial `/`).

### Comportamento
- O botao fica no header global, entre o SidebarTrigger e o conteudo
- Na rota `/` (Dashboard), o botao fica oculto pois nao ha para onde voltar
- Em todas as outras telas, o botao aparece com um icone de seta e o texto "Voltar"
- Estilo discreto (variante `ghost`) para nao competir com o conteudo

### Detalhes tecnicos

**Arquivo modificado:** `src/components/layout/AppLayout.tsx`

- Importar `useNavigate`, `useLocation` de `react-router-dom`
- Importar `ArrowLeft` de `lucide-react`
- Importar `Button` de `@/components/ui/button`
- No header, apos o `SidebarTrigger`, renderizar condicionalmente:

```tsx
{location.pathname !== '/' && (
  <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
    <ArrowLeft className="h-4 w-4" />
    Voltar
  </Button>
)}
```

Apenas **1 arquivo** precisa ser editado. Todas as telas ja usam `AppLayout`, entao o botao aparecera automaticamente em todas.
