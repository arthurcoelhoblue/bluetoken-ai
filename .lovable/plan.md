
Problema real (reformulado):
- Em produção e no preview, você reporta loop de carregamento (“rodando”) e redirecionamento automático para `/meu-dia`.
- O redirecionamento para `/meu-dia` hoje é intencional no código (`src/pages/Index.tsx`) quando a app considera a sessão autenticada.

O que eu confirmei na investigação:
- Em sessão limpa, `/` e `/auth` carregam normalmente.
- No preview limpo, o bootstrap de auth chega em “success” (sem travar).
- Não consegui reproduzir o loop infinito fora do seu contexto de sessão.
- Há um ponto crítico: o app pode tratar sessão local como válida cedo demais e te jogar para rota protegida antes de validar a sessão no backend.
- Há outro ponto frágil: rotas protegidas dependem de permissões sem timeout explícito, então qualquer requisição pendente pode manter spinner.

Do I know what the issue is?
- Parcialmente: sei exatamente os pontos de travamento prováveis (bootstrap de sessão e gate de permissões), mas ainda sem prova única do seu fluxo específico. Então a correção precisa ser “defensiva + observável” nesses dois pontos.

Plano de implementação (cirúrgico):
1) Blindar validação de sessão no bootstrap
- Arquivo: `src/contexts/AuthContext.tsx`
- Após `getSession()`, validar sessão com `getUser()` (timeout curto).
- Se validação falhar/expirar, limpar sessão local automaticamente e seguir como deslogado.
- Manter `isLoading` sempre finalizado (sem possibilidade de spinner eterno).

2) Tornar rotas protegidas fail-safe
- Arquivos: `src/components/auth/ProtectedRoute.tsx`, `src/hooks/useScreenPermissions.ts`
- Adicionar timeout/fallback de permissões (ex.: se consulta não concluir em Xs, tratar como erro controlado e mostrar ação de recuperação, não spinner infinito).
- Tratar estado `error` explicitamente (hoje só `isLoading`).

3) Eliminar fragilidade de dependência circular de permissão/admin
- Arquivo: `src/hooks/useIsAdmin.ts` + ajustes no `useScreenPermissions`
- Remover acoplamento que pode gerar comportamento imprevisível em runtime e duplicar query watchers desnecessariamente.
- Centralizar cálculo de admin/permissão em fluxo único por tela protegida.

4) Ajustar UX do redirecionamento em `/`
- Arquivo: `src/pages/Index.tsx`
- Manter regra de redirecionar autenticado, mas somente após sessão validada de fato (não apenas “sessão local existe”).
- Isso evita “pulo para `/meu-dia` + spinner” quando token estiver quebrado.

5) Telemetria mínima para fechar diagnóstico
- `console.info/warn` estruturado em:
  - bootstrap start/success/fail/timeout
  - session validated vs stale session cleared
  - protected route permission timeout/error
- Assim, na próxima execução, o erro fica inequívoco.

Validação após implementar:
- Cenário A: sessão limpa (anônimo) → `/` abre landing, `/auth` abre login.
- Cenário B: sessão inválida/corrompida → não entra em loop; cai em login ou recovery.
- Cenário C: autenticado válido → `/` redireciona para `/meu-dia` e carrega sem spinner infinito.
- Revalidar em: preview + domínio publicado.

Arquivos alvo:
- `src/contexts/AuthContext.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/hooks/useScreenPermissions.ts`
- `src/hooks/useIsAdmin.ts`
- `src/pages/Index.tsx`
- (opcional) `src/components/auth/AuthLoadingFallback.tsx`

Resultado esperado:
- Sem carregamento infinito.
- Redirecionamento para `/meu-dia` só quando a sessão estiver realmente válida.
- Em falha de sessão/permissão, usuário sempre cai em estado recuperável (login/recovery), nunca em spinner eterno.
