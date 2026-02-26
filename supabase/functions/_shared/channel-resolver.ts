// ========================================
// _shared/channel-resolver.ts — Resolve canal ativo por empresa
// Decide se mensagens devem ir via WhatsApp direto ou Blue Chat API
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOptionalEnv } from "./config.ts";

export type ChannelMode = 'DIRECT' | 'BLUECHAT' | 'META_CLOUD';

export interface ChannelConfig {
  mode: ChannelMode;
  bluechatApiUrl?: string;
  bluechatApiKey?: string;
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  metaBusinessAccountId?: string;
}

const SETTINGS_KEY_MAP: Record<string, string> = {
  'BLUE': 'bluechat_blue',
  'TOKENIZA': 'bluechat_tokeniza',
  'MPUPPE': 'bluechat_mpuppe',
  'AXIA': 'bluechat_axia',
};

/**
 * Resolve the Blue Chat API key for a given empresa.
 * 1. Tries api_key from system_settings JSON
 * 2. Falls back to BLUECHAT_API_KEY env var
 */
export async function resolveBluechatApiKey(
  supabase: SupabaseClient,
  empresa: string,
): Promise<string | null> {
  const settingsKey = SETTINGS_KEY_MAP[empresa] || 'bluechat_tokeniza';
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  const apiKey = (data?.value as Record<string, unknown>)?.api_key as string | undefined;
  if (apiKey) return apiKey;

  // Fallback to env (backward compatibility)
  return getOptionalEnv('BLUECHAT_API_KEY') || null;
}

/**
 * Resolve the Blue Chat webhook secret for validating inbound requests.
 * 1. Tries webhook_secret from system_settings JSON
 * 2. Falls back to BLUECHAT_API_KEY env var
 */
export async function resolveBluechatWebhookSecret(
  supabase: SupabaseClient,
  empresa: string,
): Promise<string | null> {
  const settingsKey = SETTINGS_KEY_MAP[empresa] || 'bluechat_tokeniza';
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  const secret = (data?.value as Record<string, unknown>)?.webhook_secret as string | undefined;
  if (secret) return secret;

  // Fallback to env (backward compatibility)
  return getOptionalEnv('BLUECHAT_API_KEY') || null;
}

/**
 * Resolve ALL webhook secrets for cross-company validation.
 * Returns array of [empresa, secret] tuples.
 */
export async function resolveAllWebhookSecrets(
  supabase: SupabaseClient,
): Promise<Array<[string, string]>> {
  const results: Array<[string, string]> = [];

  for (const [empresa, settingsKey] of Object.entries(SETTINGS_KEY_MAP)) {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', settingsKey)
      .maybeSingle();

    const secret = (data?.value as Record<string, unknown>)?.webhook_secret as string | undefined;
    if (secret) {
      results.push([empresa, secret]);
    }
  }

  return results;
}

/**
 * Resolve which channel is active for a given empresa.
 * Returns 'BLUECHAT', 'META_CLOUD', or 'DIRECT' (mensageria / whatsapp-send).
 */
export async function resolveChannelConfig(
  supabase: SupabaseClient,
  empresa: string,
): Promise<ChannelConfig> {
  // Check integration_company_config for active channel
  const { data: config } = await supabase
    .from('integration_company_config')
    .select('channel, enabled')
    .eq('empresa', empresa)
    .eq('enabled', true)
    .maybeSingle();

  const activeChannel = config?.channel as string | undefined;

  if (activeChannel === 'meta_cloud') {
    return resolveMetaCloudConfig(supabase, empresa);
  }

  if (activeChannel === 'bluechat') {
    return resolveBluechatConfig(supabase, empresa);
  }

  return { mode: 'DIRECT' };
}

/**
 * Internal: resolve Blue Chat API config from system_settings.
 */
async function resolveBluechatConfig(
  supabase: SupabaseClient,
  empresa: string,
): Promise<ChannelConfig> {
  const settingsKey = SETTINGS_KEY_MAP[empresa] || 'bluechat_tokeniza';
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  let apiUrl = (setting?.value as Record<string, unknown>)?.api_url as string | undefined;

  if (!apiUrl) {
    const { data: legacy } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', 'bluechat')
      .maybeSingle();
    apiUrl = (legacy?.value as Record<string, unknown>)?.api_url as string | undefined;
  }

  if (!apiUrl) return { mode: 'DIRECT' };

  const apiKey = await resolveBluechatApiKey(supabase, empresa);
  if (!apiKey) return { mode: 'DIRECT' };

  return {
    mode: 'BLUECHAT',
    bluechatApiUrl: apiUrl.replace(/\/$/, ''),
    bluechatApiKey: apiKey,
  };
}

/**
 * Resolve Meta Cloud API config for a given empresa.
 * Reads whatsapp_connections + access_token from system_settings.
 */
export async function resolveMetaCloudConfig(
  supabase: SupabaseClient,
  empresa: string,
): Promise<ChannelConfig> {
  // 1. Get active whatsapp_connection
  const { data: conn } = await supabase
    .from('whatsapp_connections')
    .select('phone_number_id, business_account_id')
    .eq('empresa', empresa)
    .eq('is_active', true)
    .maybeSingle();

  if (!conn?.phone_number_id) return { mode: 'DIRECT' };

  // 2. Get access token from system_settings
  const settingsKey = `meta_cloud_${empresa.toLowerCase()}`;
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  const accessToken = (setting?.value as Record<string, unknown>)?.access_token as string | undefined;

  // Fallback to env
  if (!accessToken) {
    const envToken = getOptionalEnv(`META_ACCESS_TOKEN_${empresa.toUpperCase()}`);
    if (!envToken) return { mode: 'DIRECT' };
    return {
      mode: 'META_CLOUD',
      metaPhoneNumberId: conn.phone_number_id,
      metaAccessToken: envToken,
      metaBusinessAccountId: conn.business_account_id,
    };
  }

  return {
    mode: 'META_CLOUD',
    metaPhoneNumberId: conn.phone_number_id,
    metaAccessToken: accessToken,
    metaBusinessAccountId: conn.business_account_id,
  };
}

/**
 * Resolve the Blue Chat frontend URL for a given empresa.
 * Used to build deep links for human takeover.
 */
export async function resolveBluechatFrontendUrl(
  supabase: SupabaseClient,
  empresa: string,
): Promise<string | null> {
  const settingsKey = SETTINGS_KEY_MAP[empresa] || 'bluechat_tokeniza';
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  const frontendUrl = (setting?.value as Record<string, unknown>)?.frontend_url as string | undefined;
  return frontendUrl?.replace(/\/$/, '') || null;
}

/**
 * Send a message through the Blue Chat API.
 * Uses the conversation/ticket ID to route the message.
 */
export async function sendViaBluechat(
  config: ChannelConfig,
  conversationId: string,
  message: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (config.mode !== 'BLUECHAT' || !config.bluechatApiUrl || !config.bluechatApiKey) {
    return { success: false, error: 'Blue Chat not configured' };
  }

  try {
    const res = await fetch(`${config.bluechatApiUrl}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.bluechatApiKey,
      },
      body: JSON.stringify({
        content: message,
        type: 'text',
        source: 'AMELIA',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Blue Chat API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, messageId: data?.id || data?.message_id };
  } catch (err) {
    return { success: false, error: `Blue Chat send failed: ${err}` };
  }
}

/**
 * Open a new conversation in Blue Chat for a lead (proactive outreach).
 * Returns the conversation_id and ticket_id if successful.
 */
export async function openBluechatConversation(
  config: ChannelConfig,
  telefone: string,
  nomeLead?: string | null,
): Promise<{ success: boolean; conversationId?: string; ticketId?: string; error?: string }> {
  if (config.mode !== 'BLUECHAT' || !config.bluechatApiUrl || !config.bluechatApiKey) {
    return { success: false, error: 'Blue Chat not configured' };
  }

  try {
    const res = await fetch(`${config.bluechatApiUrl}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.bluechatApiKey,
      },
      body: JSON.stringify({
        phone: telefone,
        contact_name: nomeLead || undefined,
        channel: 'whatsapp',
        source: 'AMELIA',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Blue Chat open conversation error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return {
      success: true,
      conversationId: data?.conversation_id || data?.id,
      ticketId: data?.ticket_id,
    };
  } catch (err) {
    return { success: false, error: `Blue Chat open conversation failed: ${err}` };
  }
}

// ========================================
// Meta Cloud API helpers
// ========================================

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaTemplateSendParams {
  templateName: string;
  languageCode?: string;
  components?: Array<{
    type: string;
    parameters: Array<{ type: string; text?: string; image?: { link: string } }>;
  }>;
}

/**
 * Send a template message via Meta Cloud API.
 */
export async function sendTemplateViaMetaCloud(
  config: ChannelConfig,
  to: string,
  template: MetaTemplateSendParams,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (config.mode !== 'META_CLOUD' || !config.metaPhoneNumberId || !config.metaAccessToken) {
    return { success: false, error: 'Meta Cloud not configured' };
  }

  try {
    const res = await fetch(`${META_BASE_URL}/${config.metaPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.metaAccessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template.templateName,
          language: { code: template.languageCode || 'pt_BR' },
          components: template.components || [],
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Meta API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: `Meta Cloud send failed: ${err}` };
  }
}

/**
 * Send a free-form text message via Meta Cloud API (within 24h window).
 */
export async function sendTextViaMetaCloud(
  config: ChannelConfig,
  to: string,
  message: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (config.mode !== 'META_CLOUD' || !config.metaPhoneNumberId || !config.metaAccessToken) {
    return { success: false, error: 'Meta Cloud not configured' };
  }

  try {
    const res = await fetch(`${META_BASE_URL}/${config.metaPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.metaAccessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Meta API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: `Meta Cloud send failed: ${err}` };
  }
}

// ========================================
// Media sending helpers
// ========================================

/**
 * Send an image via Meta Cloud API.
 */
export async function sendImageViaMetaCloud(
  config: ChannelConfig,
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'image', { link: imageUrl }, caption);
}

/**
 * Send a document via Meta Cloud API.
 */
export async function sendDocumentViaMetaCloud(
  config: ChannelConfig,
  to: string,
  documentUrl: string,
  filename?: string,
  caption?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'document', { link: documentUrl, filename }, caption);
}

/**
 * Send an audio via Meta Cloud API.
 */
export async function sendAudioViaMetaCloud(
  config: ChannelConfig,
  to: string,
  audioUrl: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'audio', { link: audioUrl });
}

/**
 * Send a video via Meta Cloud API.
 */
export async function sendVideoViaMetaCloud(
  config: ChannelConfig,
  to: string,
  videoUrl: string,
  caption?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'video', { link: videoUrl }, caption);
}

/**
 * Generic media send helper.
 */
async function sendMediaViaMetaCloud(
  config: ChannelConfig,
  to: string,
  mediaType: string,
  mediaPayload: Record<string, unknown>,
  caption?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (config.mode !== 'META_CLOUD' || !config.metaPhoneNumberId || !config.metaAccessToken) {
    return { success: false, error: 'Meta Cloud not configured' };
  }

  const payload: Record<string, unknown> = { ...mediaPayload };
  if (caption) payload.caption = caption;

  try {
    const res = await fetch(`${META_BASE_URL}/${config.metaPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.metaAccessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
        [mediaType]: payload,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Meta API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: `Meta Cloud media send failed: ${err}` };
  }
}
