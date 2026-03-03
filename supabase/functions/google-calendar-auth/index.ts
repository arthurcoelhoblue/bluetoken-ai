import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const supabase = createServiceClient();

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      body = await req.json();
    }
    const action = url.searchParams.get("action") || (body.action as string);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return json({ error: "Google Calendar credentials not configured" }, 500);
    }

    // ========== GET AUTH URL ==========
    if (action === "get_auth_url") {
      const redirectUri = url.searchParams.get("redirect_uri") || (body.redirect_uri as string) || `${url.origin}/google-calendar-auth?action=callback`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${user.id}`;
      return json({ url: authUrl });
    }

    // ========== CALLBACK ==========
    if (action === "callback") {
      const code = url.searchParams.get("code") || (body.code as string);
      const redirectUri = url.searchParams.get("redirect_uri") || (body.redirect_uri as string);
      if (!code || !redirectUri) return json({ error: "Missing code or redirect_uri" }, 400);

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) return json({ error: "Token exchange failed", details: tokenData }, 400);

      const expiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      const { error: upsertErr } = await supabase.from("user_google_tokens").upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expiry: expiry,
        scope: tokenData.scope || SCOPES,
      }, { onConflict: "user_id" });

      if (upsertErr) return json({ error: "Failed to save tokens", details: upsertErr.message }, 500);
      return json({ success: true, connected: true });
    }

    // ========== REFRESH ==========
    if (action === "refresh") {
      const { data: tokens } = await supabase
        .from("user_google_tokens")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!tokens) return json({ error: "No Google tokens found" }, 404);

      const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokens.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshResp.json();
      if (!refreshResp.ok) return json({ error: "Refresh failed", details: refreshData }, 400);

      const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
      await supabase.from("user_google_tokens").update({
        access_token: refreshData.access_token,
        token_expiry: newExpiry,
      }).eq("user_id", user.id);

      return json({ success: true, access_token: refreshData.access_token, expiry: newExpiry });
    }

    // ========== DISCONNECT ==========
    if (action === "disconnect") {
      await supabase.from("user_google_tokens").delete().eq("user_id", user.id);
      return json({ success: true, connected: false });
    }

    // ========== STATUS ==========
    if (action === "status") {
      const { data: tokens } = await supabase
        .from("user_google_tokens")
        .select("token_expiry, scope")
        .eq("user_id", user.id)
        .maybeSingle();

      return json({
        connected: !!tokens,
        expiry: tokens?.token_expiry || null,
        scope: tokens?.scope || null,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
