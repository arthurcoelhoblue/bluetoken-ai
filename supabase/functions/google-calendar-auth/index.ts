// ========================================
// GOOGLE CALENDAR AUTH — OAuth2 flow for per-seller Google Calendar integration
// Endpoints:
//   POST { action: 'get_auth_url', user_id } → returns OAuth URL
//   POST { action: 'callback', code, user_id } → exchanges code for tokens
//   POST { action: 'refresh', user_id } → refreshes access token
//   POST { action: 'disconnect', user_id } → removes tokens
//   POST { action: 'status', user_id } → returns connection status
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig, getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('google-calendar-auth');

const GOOGLE_CLIENT_ID = getOptionalEnv('GOOGLE_CALENDAR_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = getOptionalEnv('GOOGLE_CALENDAR_CLIENT_SECRET') || '';
const GOOGLE_REDIRECT_URI = getOptionalEnv('GOOGLE_CALENDAR_REDIRECT_URI') || `${envConfig.SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);
    
    // Support both JSON body and URL params (for OAuth callback redirect)
    let action: string;
    let userId: string | null = null;
    let code: string | null = null;
    let state: string | null = null;

    const url = new URL(req.url);
    if (url.searchParams.has('code')) {
      // OAuth callback from Google
      action = 'callback';
      code = url.searchParams.get('code');
      state = url.searchParams.get('state');
      userId = state; // We pass user_id as state
    } else {
      const body = await req.json();
      action = body.action;
      userId = body.user_id;
      code = body.code;
    }

    switch (action) {
      case 'get_auth_url': {
        if (!userId) throw new Error('user_id required');
        if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CALENDAR_CLIENT_ID not configured');

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', userId);

        return new Response(JSON.stringify({ url: authUrl.toString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'callback': {
        if (!code || !userId) throw new Error('code and state (user_id) required');

        // Exchange code for tokens
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResp.ok) {
          const err = await tokenResp.text();
          log.error('Token exchange failed', { error: err });
          throw new Error(`Token exchange failed: ${err}`);
        }

        const tokens = await tokenResp.json();
        const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

        // Get user email from Google
        let googleEmail: string | null = null;
        try {
          const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (userInfoResp.ok) {
            const userInfo = await userInfoResp.json();
            googleEmail = userInfo.email;
          }
        } catch { /* ignore */ }

        // Upsert tokens
        const { error } = await supabase.from('user_google_tokens').upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || '',
          token_expiry: expiresAt,
          google_email: googleEmail,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (error) {
          log.error('Failed to save tokens', { error: error.message });
          throw error;
        }

        // Create default meeting config if not exists
        await supabase.from('user_meeting_config').upsert({
          user_id: userId,
          duracao_minutos: 45,
          intervalo_entre_reunioes: 15,
          antecedencia_minima_horas: 2,
          antecedencia_maxima_dias: 14,
          google_meet_automatico: true,
        }, { onConflict: 'user_id' });

        // Create default availability (seg-sex, 9h-12h e 14h-18h)
        const { data: existingAvail } = await supabase.from('user_availability').select('id').eq('user_id', userId).limit(1);
        if (!existingAvail?.length) {
          const defaultSlots = [];
          for (let dia = 1; dia <= 5; dia++) { // seg=1 a sex=5
            defaultSlots.push({ user_id: userId, dia_semana: dia, hora_inicio: '09:00', hora_fim: '12:00' });
            defaultSlots.push({ user_id: userId, dia_semana: dia, hora_inicio: '14:00', hora_fim: '18:00' });
          }
          await supabase.from('user_availability').insert(defaultSlots);
        }

        log.info('Google Calendar connected', { userId, googleEmail });

        // Redirect to app (close popup or redirect)
        const appUrl = getOptionalEnv('APP_URL') || 'https://app.bluetoken.ai';
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': `${appUrl}/me?calendar=connected` },
        });
      }

      case 'refresh': {
        if (!userId) throw new Error('user_id required');

        const { data: tokenData } = await supabase.from('user_google_tokens')
          .select('refresh_token, token_expiry')
          .eq('user_id', userId)
          .single();

        if (!tokenData?.refresh_token) throw new Error('No refresh token found');

        // Check if token is still valid
        const expiry = new Date(tokenData.token_expiry);
        if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
          // Token still valid for > 5 minutes
          const { data: currentToken } = await supabase.from('user_google_tokens')
            .select('access_token')
            .eq('user_id', userId)
            .single();
          return new Response(JSON.stringify({ access_token: currentToken?.access_token, expires_at: tokenData.token_expiry }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Refresh the token
        const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            refresh_token: tokenData.refresh_token,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResp.ok) {
          const err = await refreshResp.text();
          log.error('Token refresh failed', { error: err, userId });
          // Mark as disconnected
          await supabase.from('user_google_tokens').delete().eq('user_id', userId);
          throw new Error('Token refresh failed — user needs to reconnect');
        }

        const newTokens = await refreshResp.json();
        const newExpiry = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString();

        await supabase.from('user_google_tokens').update({
          access_token: newTokens.access_token,
          token_expiry: newExpiry,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);

        return new Response(JSON.stringify({ access_token: newTokens.access_token, expires_at: newExpiry }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        if (!userId) throw new Error('user_id required');
        await supabase.from('user_google_tokens').delete().eq('user_id', userId);
        log.info('Google Calendar disconnected', { userId });
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'status': {
        if (!userId) throw new Error('user_id required');
        const { data } = await supabase.from('user_google_tokens')
          .select('google_email, connected_at, token_expiry')
          .eq('user_id', userId)
          .maybeSingle();

        const connected = !!data;
        const expired = data ? new Date(data.token_expiry) < new Date() : false;

        return new Response(JSON.stringify({
          connected,
          expired,
          google_email: data?.google_email,
          connected_at: data?.connected_at,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
