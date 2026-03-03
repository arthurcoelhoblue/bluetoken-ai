

## Diagnóstico: Faltam 2 coisas para o Google Calendar funcionar

### Problema real identificado

Analisando os requests de rede, a edge function funciona corretamente — ela retorna a URL do Google OAuth com o `redirect_uri` correto. Porém, existem **dois problemas**:

### 1. Não existe código de callback no frontend
Quando o Google redireciona de volta para `/settings?code=XXXX`, **nenhum código** no frontend detecta esse parâmetro `code` e chama a edge function com `action: "callback"` para completar a troca de tokens. O fluxo OAuth simplesmente morre ali.

### 2. Redirect URI não autorizado no Google Cloud Console
O usuário está testando pelo preview (`https://2e625147-...lovableproject.com/settings`), mas essa URL provavelmente não está nas Authorized redirect URIs do Google Cloud Console. Além disso, o botão está na página `/me`, mas o redirect aponta para `/settings`.

### Solução

**Arquivo 1: `src/components/calendar/CalendarConfigPanel.tsx`**
- Corrigir o `redirect_uri` para usar `/me` em vez de `/settings` (já que o painel está em `/me`)
- Adicionar um `useEffect` que detecta `?code=` na URL ao carregar o componente e chama a edge function com `action: "callback"` para completar o fluxo OAuth

```typescript
// No CalendarConfigPanel, adicionar:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    // Remove code from URL
    window.history.replaceState({}, '', window.location.pathname);
    // Complete OAuth flow
    supabase.functions.invoke('google-calendar-auth', {
      body: { 
        action: 'callback', 
        code, 
        redirect_uri: window.location.origin + '/me' 
      },
    }).then(resp => {
      if (resp.data?.success) toast.success('Google Calendar conectado!');
      else toast.error('Erro ao conectar Google Calendar');
      // Refresh status
      queryClient.invalidateQueries(['google-calendar-status']);
    });
  }
}, []);
```

E no `handleConnectGoogle`, mudar `/settings` para `/me`:
```typescript
const redirectUri = `${window.location.origin}/me`;
```

### Ação do usuário necessária
No Google Cloud Console, adicionar estas URLs nas **Authorized redirect URIs**:
- `https://amelia.com.br/me`
- `https://sdrgrupobue.lovable.app/me`
- A URL do preview se quiser testar por lá também

### Arquivos alterados
- `src/components/calendar/CalendarConfigPanel.tsx` (adicionar callback handler + corrigir redirect path)

