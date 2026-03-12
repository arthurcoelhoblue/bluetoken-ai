
Diagnóstico (com base na investigação)
- O problema não parece ser DNS/domínio: em ambiente limpo, as rotas `/auth`, `/meu-dia` e `/pipeline` respondem e renderizam.
- Seu retorno de clarificação foi: erro em **ambos os domínios** e **sempre**.
- Sinal forte de causa no cliente: o bootstrap de autenticação pode travar em `isLoading=true` (AuthContext) quando `getSession()` falha/pendura, porque hoje não há proteção completa de timeout + recuperação local.

Plano de correção (foco em resolver “fica rodando”)
1) Endurecer bootstrap de auth (`src/contexts/AuthContext.tsx`)
- Envolver inicialização em `try/catch/finally`.
- Garantir `setIsLoading(false)` em todos os caminhos (sucesso, erro, timeout).
- Adicionar timeout defensivo (ex.: 6–8s) para `getSession()` com fallback seguro.

2) Auto-recuperação de sessão corrompida
- Em erro de bootstrap, limpar sessão local (sign-out local) e resetar estado (`user/session/profile/roles`).
- Evitar loop com guard de “tentativa única” em `sessionStorage` (mesma estratégia do ChunkErrorBoundary).

3) Desacoplar carregamento de perfil do bloqueio global
- Não manter tela inteira travada aguardando `fetchProfile`.
- Finalizar bootstrap de auth primeiro; carregar `profile/roles` em background com tratamento de erro separado.

4) Fallback de UX explícito
- Se bootstrap exceder timeout, mostrar tela curta com:
  - “Recarregar sessão”
  - “Limpar sessão e entrar novamente”
- Isso elimina “spinner infinito silencioso”.

5) Observabilidade mínima para produção
- Logs estruturados de bootstrap (`auth_bootstrap_start/success/error/timeout`) para identificar recorrência.
- Captura de erro no monitoramento para classificar causa real (rede, token inválido, storage corrompido).

Validação (antes de considerar resolvido)
- Teste em sessão “suja” (com storage antigo) e sessão limpa/incógnita.
- Verificar:
  - `/auth` abre sem loop
  - `/meu-dia` redireciona corretamente para `/auth` quando não autenticado
  - login completo volta ao fluxo normal
- Revalidar nos dois domínios.

Arquivos-alvo
- `src/contexts/AuthContext.tsx` (principal)
- Opcional: componente de fallback de recuperação (novo arquivo simples em `src/components/auth/...`)

Critério de sucesso
- Não existe mais cenário com loading infinito global.
- Em falha de sessão/local storage, o usuário sempre cai em estado recuperável (login visível + ação de recuperação).
