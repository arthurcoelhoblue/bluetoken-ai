

## Auditoria Completa — Pontas Soltas e Correções Necessárias

Fiz uma varredura completa nas rotas, sidebar, edge functions, hooks e separação backend/frontend. Aqui estão **todas as pontas soltas** encontradas, organizadas por criticidade.

---

### 1. Página `LeadsList` importada mas sem rota (código morto)

`LeadsList` é importado via `lazy()` na linha 23 do `App.tsx`, mas **nunca é usado em nenhuma `<Route>`**. A rota `/leads` faz `Navigate` para `/contatos`. O componente inteiro (572 linhas) é código morto.

**Correção:** Remover o import lazy de `LeadsList` do `App.tsx`.

---

### 2. Página `/admin/email-smtp` — sem entrada na sidebar

A rota existe, a página funciona, mas **não aparece no menu lateral**. O único acesso é via card de integrações (`/admin/settings`). Qualquer admin pode ficar sem saber que a página existe.

**Correção:** Adicionar item `{ title: 'E-mail SMTP', url: '/admin/email-smtp', icon: Mail, screenKey: 'email_smtp' }` ao grupo "Configuração" da sidebar.

---

### 3. Página `/tokeniza/offers` — sem entrada na sidebar

Mesma situação: rota registrada, página funcional, mas **zero links na sidebar**. Inacessível pela navegação normal.

**Correção:** Adicionar item `{ title: 'Ofertas Tokeniza', url: '/tokeniza/offers', icon: TrendingUp, screenKey: 'tokeniza_offers' }` ao grupo "Comercial" da sidebar.

---

### 4. `handleDisconnectGoogle` — não invalida cache após desconectar

Ao desconectar o Google Calendar, o `handleDisconnectGoogle` não chama `queryClient.invalidateQueries` para `google-calendar-status`. O badge de "Conectado" persiste até o usuário recarregar a página.

**Correção:** Adicionar `queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] })` após o sucesso da desconexão.

---

### 5. `useCalendarConfig` — uso de `as any` para tabelas que existem nos types

As tabelas `user_availability` e `user_meeting_config` **existem no types.ts**, mas o hook usa `as any` em todas as chamadas. Isso anula a tipagem do Supabase e pode esconder erros silenciosos.

**Correção:** Remover todos os `as any` e usar os tipos corretos (as tabelas já estão no schema).

---

### 6. Consistência de `ErrorBoundary` — 6 rotas protegidas sem ele

Todas as rotas complexas usam `<ErrorBoundary>`, exceto:
- `/me`
- `/leads/:leadId/:empresa`
- `/cadences/new`, `/cadences/:cadenceId/edit`
- `/cadences/runs/:runId`
- `/cadences/next-actions`
- `/cadences/:cadenceId`
- `/cadences`
- `/wiki`
- `/capture-forms` e `/capture-forms/:id/edit`
- `/tokeniza/offers`

Se alguma dessas páginas lançar um erro, o app inteiro cai em vez de mostrar um fallback.

**Correção:** Envolver todas essas rotas com `<ErrorBoundary>`.

---

### 7. Google Calendar — redirect URI hardcoded para `ameliacrm.com.br`

O redirect está hardcoded para `https://ameliacrm.com.br/me`. Se o domínio de produção mudar ou alguém testar pelo domínio publicado (`sdrgrupobue.lovable.app`), o fluxo OAuth quebrará silenciosamente. Não é um bug hoje, mas é uma fragilidade.

**Correção (baixa prioridade):** Manter como está se `ameliacrm.com.br` é definitivo. Caso contrário, usar uma variável de configuração ou fallback com `window.location.origin` + override para produção.

---

### Resumo de Alterações

| # | Arquivo | Tipo | Descrição |
|---|---------|------|-----------|
| 1 | `src/App.tsx` | Limpeza | Remover import morto `LeadsList` |
| 2 | `src/App.tsx` | Robustez | Adicionar `ErrorBoundary` em ~10 rotas desprotegidas |
| 3 | `src/components/layout/AppSidebar.tsx` | Feature | Adicionar "E-mail SMTP" e "Ofertas Tokeniza" na sidebar |
| 4 | `src/components/calendar/CalendarConfigPanel.tsx` | Bug fix | Invalidar cache ao desconectar Google Calendar |
| 5 | `src/hooks/useCalendarConfig.ts` | Tipagem | Remover `as any` das queries (tabelas existem no schema) |

Nenhuma alteração de banco de dados necessária. Nenhuma edge function precisa ser modificada.

