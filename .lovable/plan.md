
Objetivo: eliminar de forma definitiva o “spinner infinito” pós-login e capturar o ponto exato de falha com trace confiável em produção e preview.

1) Diagnóstico consolidado (a partir dos logs atuais)
- Backend de autenticação está respondendo: login e validação de usuário retornando 200.
- Perfil e papéis também aparecem carregando com sucesso em execuções boas.
- O erro fatal observado é frontend: `useAuth must be used within an AuthProvider` (derruba a renderização).
- Há um bug de fluxo no bootstrap que pode gerar spinner infinito:
  - no caminho `verify_timeout_fallback` o app finaliza bootstrap sem garantir `profileLoaded=true` + sem garantir fetch de perfil/roles.
  - isso pode deixar rota protegida em loading indefinido.

2) Correções definitivas propostas
- `src/contexts/AuthContext.tsx`
  - Garantir que TODO caminho de bootstrap conclua com estado terminal consistente:
    - `profileLoaded` sempre definido (sucesso ou fallback controlado).
  - No fallback de timeout de `getUser`, disparar fetch de perfil com timeout próprio (não infinito).
  - Adicionar timeout em `fetchProfile`/`roles` para evitar promessa pendurada.
  - Introduzir `bootstrapId` + logs estruturados `[Auth:TRACE]` por etapa (start, session_ok, user_ok, profile_ok, roles_ok, finish_reason).

- `src/components/auth/ProtectedRoute.tsx`
  - Bloquear decisão de acesso quando `screenKey` existir e permissões ainda não estiverem materializadas (evitar estado ambíguo).
  - Exibir tela de recuperação explícita com motivo (perfil pendente, permissões pendentes, timeout).

- `src/components/ErrorBoundary.tsx` + `src/components/ChunkErrorBoundary.tsx`
  - Tratar `useAuth must be used within an AuthProvider` como erro recuperável de runtime mismatch (mesma família de inconsistência de bundle).
  - Auto-reload controlado (limitado por janela), depois UI de recuperação manual (limpar cache + recarregar).

- `src/main.tsx`
  - Adicionar handlers globais para erros de preload/chunk (`vite:preloadError`, `unhandledrejection`, erro de import de módulo) com hard-reload controlado por sessão.

3) Estratégia de trace para fechar diagnóstico
- Padronizar logs com códigos de fase:
  - `AUTH_BOOTSTRAP_START`, `AUTH_GET_SESSION_OK`, `AUTH_GET_USER_TIMEOUT`, `AUTH_PROFILE_TIMEOUT`, `AUTH_FINISH_<reason>`.
- Incluir rota atual e timestamp relativo no trace para correlacionar com requests de rede.
- Resultado: no próximo incidente, conseguimos identificar em segundos se foi:
  - timeout de validação,
  - timeout de perfil,
  - mismatch de bundle/chunk,
  - ou erro de permissão.

4) Validação (preview + fora do preview, prioridade produção)
- Produção (domínio principal):
  - fluxo limpo: abrir `/auth` → login → redirecionar para `/meu-dia` sem spinner infinito;
  - deep-link com sessão existente: abrir `/pipeline` diretamente.
- Preview:
  - repetir os dois fluxos acima;
  - validar comportamento de auto-recuperação em erro de chunk/context mismatch.
- Critério de aceite:
  - sem travamento em spinner;
  - sem crash por `useAuth must be used within an AuthProvider`;
  - logs de trace mostrando `finish_reason` claro em 100% dos boots.

5) Escopo e risco
- Sem mudança de banco.
- Correção concentrada no frontend de autenticação/roteamento/resiliência.
- Risco baixo-médio, com alto ganho de estabilidade operacional.
