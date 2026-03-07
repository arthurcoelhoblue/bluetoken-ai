import { createServiceClient } from "../_shared/config.ts";
import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("push-send");

// ── Google OAuth2 token from service account ────────────────────────
async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  // Import private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${header}.${payload}.${signature}`;

  const resp = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Google token exchange failed: ${resp.status} ${txt}`);
  }
  const data = await resp.json();
  return data.access_token;
}

// ── Cache access token (reuse across warm invocations) ──────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getFcmToken(sa: any): Promise<string> {
  if (cachedToken && Date.now() / 1000 < tokenExpiry - 120) return cachedToken;
  cachedToken = await getAccessToken(sa);
  tokenExpiry = Math.floor(Date.now() / 1000) + 3600;
  return cachedToken;
}

// ── Main handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleWebhookCorsOptions();
  const cors = getWebhookCorsHeaders();

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();
    const { user_id, titulo, mensagem, tipo, link } = body;

    if (!user_id) return json({ error: "Missing user_id" }, 400);

    // Load Firebase SA
    const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!saRaw) {
      log.error("FIREBASE_SERVICE_ACCOUNT_JSON not configured");
      return json({ error: "Firebase not configured" }, 500);
    }
    const sa = JSON.parse(saRaw);
    const projectId = sa.project_id;

    // Fetch push tokens
    const supabase = createServiceClient();
    const { data: tokens, error: tokErr } = await supabase
      .from("push_tokens")
      .select("id, token, platform")
      .eq("user_id", user_id);

    if (tokErr) {
      log.error("Failed to fetch push_tokens", { error: tokErr.message });
      return json({ error: tokErr.message }, 500);
    }

    if (!tokens || tokens.length === 0) {
      log.info("No push tokens for user", { user_id });
      return json({ sent: 0, skipped: "no_tokens" });
    }

    // Get FCM access token
    const accessToken = await getFcmToken(sa);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    let removed = 0;
    const errors: string[] = [];

    for (const t of tokens) {
      const message: Record<string, unknown> = {
        token: t.token,
        notification: {
          title: titulo || "Nova notificação",
          body: mensagem || "",
        },
        data: {
          tipo: tipo || "",
          link: link || "",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      };

      // Platform-specific config
      if (t.platform === "android") {
        message.android = { priority: "high" };
      } else if (t.platform === "ios") {
        message.apns = {
          payload: { aps: { sound: "default", badge: 1 } },
        };
      }

      const resp = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (resp.ok) {
        sent++;
      } else {
        const err = await resp.json().catch(() => ({}));
        const code = err?.error?.details?.[0]?.errorCode || err?.error?.status || "UNKNOWN";

        if (code === "UNREGISTERED" || code === "NOT_FOUND") {
          // Token is stale — remove it
          await supabase.from("push_tokens").delete().eq("id", t.id);
          removed++;
          log.info("Removed stale token", { tokenId: t.id, platform: t.platform });
        } else {
          errors.push(`${t.platform}:${code}`);
          log.warn("FCM send failed", { tokenId: t.id, code });
        }
      }
    }

    log.info("Push send complete", { user_id, sent, removed, errors: errors.length });
    return json({ sent, removed, errors });
  } catch (err) {
    log.captureException(err instanceof Error ? err : new Error(String(err)));
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
