

## Diagnosis

The `google-calendar-auth` function is correctly configured in `config.toml` and responds to direct curl calls (returns proper 401 JSON). The CORS module allows `.lovable.app` origins. Google Calendar secrets are set.

The persistent "Failed to send a request to the Edge Function" error from the browser means the request never completes successfully at the HTTP level. This happens when:
1. The deployment didn't pick up the latest `config.toml` change
2. Or the function binary is stale from a previous deployment

## Fix

**Force redeploy the edge function** to ensure the latest config.toml settings are applied. The function code itself doesn't need changes -- only a fresh deployment cycle.

Additionally, add more granular error logging in the frontend to capture the exact fetch error if it persists after redeploy:

**`src/components/calendar/CalendarConfigPanel.tsx`** -- wrap the invoke call in try/catch to distinguish between network errors and function errors:

```typescript
const handleConnectGoogle = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast.error('Faça login primeiro'); return; }

  const redirectUri = `${window.location.origin}/me`;
  try {
    const resp = await supabase.functions.invoke('google-calendar-auth', {
      body: { action: 'get_auth_url', redirect_uri: redirectUri },
    });
    
    console.log('Google Calendar auth response:', { data: resp.data, error: resp.error });
    
    if (resp.error) {
      console.error('Google Calendar auth error:', resp.error);
      toast.error(`Erro ao conectar: ${resp.error.message || 'Erro desconhecido'}`);
      return;
    }
    
    if (resp.data?.url) {
      window.location.href = resp.data.url;
    } else {
      console.error('Google Calendar auth response sem URL:', resp.data);
      toast.error('Erro ao obter URL de autorização.');
    }
  } catch (err) {
    console.error('Google Calendar fetch exception:', err);
    toast.error('Erro de rede ao conectar Google Calendar. Tente novamente.');
  }
};
```

This two-step approach (redeploy + better logging) will either fix the issue immediately or give us the exact error to diagnose further.

