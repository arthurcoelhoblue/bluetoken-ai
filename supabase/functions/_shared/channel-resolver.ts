// ========================================
// _shared/channel-resolver.ts — Resolve canal ativo por empresa
// Decide se mensagens devem ir via WhatsApp direto (Mensageria) ou Meta Cloud API
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOptionalEnv } from "./config.ts";

export type ChannelMode = 'DIRECT' | 'META_CLOUD';

export interface ChannelConfig {
  mode: ChannelMode;
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  metaBusinessAccountId?: string;
  connectionId?: string;
}

/**
 * Resolve which channel is active for a given empresa.
 * Returns 'META_CLOUD' or 'DIRECT' (mensageria / whatsapp-send).
 */
export async function resolveChannelConfig(
  supabase: SupabaseClient,
  empresa: string,
): Promise<ChannelConfig> {
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

  return { mode: 'DIRECT' };
}

/**
 * Resolve Meta Cloud API config for a given empresa.
 */
export async function resolveMetaCloudConfig(
  supabase: SupabaseClient,
  empresa: string,
  connectionId?: string,
): Promise<ChannelConfig> {
  let conn: { id: string; phone_number_id: string; business_account_id: string | null; access_token: string | null; app_secret: string | null } | null = null;

  if (connectionId) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('id, phone_number_id, business_account_id, access_token, app_secret')
      .eq('id', connectionId)
      .eq('is_active', true)
      .maybeSingle();
    conn = data;
  } else {
    // Try default first, then any active
    const { data: defaultConn } = await supabase
      .from('whatsapp_connections')
      .select('id, phone_number_id, business_account_id, access_token, app_secret')
      .eq('empresa', empresa)
      .eq('is_active', true)
      .eq('is_default', true)
      .maybeSingle();
    conn = defaultConn;
    if (!conn) {
      const { data: anyConn } = await supabase
        .from('whatsapp_connections')
        .select('id, phone_number_id, business_account_id, access_token, app_secret')
        .eq('empresa', empresa)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      conn = anyConn;
    }
  }

  if (!conn?.phone_number_id) return { mode: 'DIRECT' };

  // 1. Try access_token from the connection itself
  let accessToken = conn.access_token as string | undefined;

  // 2. Fallback: system_settings (legacy per-empresa config)
  if (!accessToken) {
    const settingsKey = `meta_cloud_${empresa.toLowerCase()}`;
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', settingsKey)
      .maybeSingle();
    accessToken = (setting?.value as Record<string, unknown>)?.access_token as string | undefined;
  }

  // 3. Fallback: environment variable
  if (!accessToken) {
    const envToken = getOptionalEnv(`META_ACCESS_TOKEN_${empresa.toUpperCase()}`);
    if (!envToken) return { mode: 'DIRECT' };
    accessToken = envToken;
  }

  return {
    mode: 'META_CLOUD',
    metaPhoneNumberId: conn.phone_number_id,
    metaAccessToken: accessToken,
    metaBusinessAccountId: conn.business_account_id,
    connectionId: conn.id,
  };
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

export async function sendImageViaMetaCloud(
  config: ChannelConfig, to: string, imageUrl: string, caption?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'image', { link: imageUrl }, caption);
}

export async function sendDocumentViaMetaCloud(
  config: ChannelConfig, to: string, documentUrl: string, filename?: string, caption?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'document', { link: documentUrl, filename }, caption);
}

export async function sendAudioViaMetaCloud(
  config: ChannelConfig, to: string, audioUrl: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'audio', { link: audioUrl });
}

export async function sendVideoViaMetaCloud(
  config: ChannelConfig, to: string, videoUrl: string, caption?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendMediaViaMetaCloud(config, to, 'video', { link: videoUrl }, caption);
}

/**
 * List all active WhatsApp connections for a given empresa.
 */
export async function listActiveConnections(
  supabase: SupabaseClient,
  empresa: string,
): Promise<Array<{ id: string; label: string | null; display_phone: string | null; verified_name: string | null; is_default: boolean }>> {
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('id, label, display_phone, verified_name, is_default')
    .eq('empresa', empresa)
    .eq('is_active', true)
    .order('is_default', { ascending: false });
  return (data ?? []) as any[];
}

async function sendMediaViaMetaCloud(
  config: ChannelConfig, to: string, mediaType: string, mediaPayload: Record<string, unknown>, caption?: string,
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
      return { success: false, error: `Meta API ${mediaType} error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: `Meta Cloud ${mediaType} send failed: ${err}` };
  }
}

// ========================================
// Media Upload API — upload file to Meta and get media_id
// ========================================

/**
 * Upload a media file to Meta's Media API, returning a reusable media_id.
 * This is more reliable for audio because Meta handles format validation internally.
 */
export async function uploadMediaToMeta(
  config: ChannelConfig,
  fileUrl: string,
  mimeType: string,
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  if (config.mode !== 'META_CLOUD' || !config.metaPhoneNumberId || !config.metaAccessToken) {
    return { success: false, error: 'Meta Cloud not configured' };
  }

  try {
    // 1. Download the file from storage
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return { success: false, error: `Failed to download file: ${fileRes.status}` };
    }
    const fileBlob = await fileRes.blob();

    // 2. Upload to Meta Media API using multipart/form-data
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);
    formData.append('file', new Blob([await fileBlob.arrayBuffer()], { type: mimeType }), 'audio.ogg');

    const uploadRes = await fetch(`${META_BASE_URL}/${config.metaPhoneNumberId}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.metaAccessToken}`,
      },
      body: formData,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      return { success: false, error: `Meta Media Upload error ${uploadRes.status}: ${text}` };
    }

    const data = await uploadRes.json();
    return { success: true, mediaId: data?.id };
  } catch (err) {
    return { success: false, error: `Meta Media Upload failed: ${err}` };
  }
}

/**
 * Send an audio message using a pre-uploaded media_id instead of a direct link.
 */
export async function sendAudioByIdViaMetaCloud(
  config: ChannelConfig,
  to: string,
  mediaId: string,
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
        type: 'audio',
        audio: { id: mediaId },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Meta API audio-by-id error ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: `Meta Cloud audio-by-id send failed: ${err}` };
  }
}
