import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { resolveMetaCloudConfig, type ChannelConfig } from "../_shared/channel-resolver.ts";

const log = createLogger('whatsapp-template-manager');
const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);

  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const supabase = createServiceClient();
    const url = new URL(req.url);
    const empresa = url.searchParams.get('empresa');

    if (!empresa) return json({ error: 'empresa query param required' }, 400);

    // Resolve Meta credentials
    const config = await resolveMetaCloudConfig(supabase, empresa);
    if (config.mode !== 'META_CLOUD' || !config.metaAccessToken || !config.metaBusinessAccountId) {
      return json({ error: `Meta Cloud não configurado para ${empresa}` }, 400);
    }

    const method = req.method;

    // ========================================
    // GET — List templates from Meta
    // ========================================
    if (method === 'GET') {
      const res = await fetch(
        `${META_BASE}/${config.metaBusinessAccountId}/message_templates?limit=100`,
        { headers: { Authorization: `Bearer ${config.metaAccessToken}` } }
      );
      if (!res.ok) {
        const err = await res.text();
        log.error('Meta list error', { status: res.status, err });
        return json({ error: `Meta API ${res.status}: ${err}` }, res.status);
      }
      const data = await res.json();
      return json({ templates: data.data || [], paging: data.paging });
    }

    // ========================================
    // POST — Create template on Meta + sync local
    // ========================================
    if (method === 'POST') {
      const body = await req.json();
      const { name, category, language, components, localTemplateId } = body;

      if (!name || !category || !components) {
        return json({ error: 'name, category, components required' }, 400);
      }

      const metaPayload = {
        name,
        category,
        language: language || 'pt_BR',
        components,
      };

      const res = await fetch(
        `${META_BASE}/${config.metaBusinessAccountId}/message_templates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.metaAccessToken}`,
          },
          body: JSON.stringify(metaPayload),
        }
      );

      const responseData = await res.json();

      if (!res.ok) {
        log.error('Meta create error', { status: res.status, responseData });
        return json({ error: `Meta API ${res.status}`, details: responseData }, res.status);
      }

      // Sync local template
      if (localTemplateId) {
        await supabase
          .from('message_templates')
          .update({
            meta_template_id: responseData.id,
            meta_status: responseData.status || 'PENDING',
            meta_category: category,
            meta_language: language || 'pt_BR',
            meta_components: components,
          })
          .eq('id', localTemplateId);
      }

      log.info('Template created on Meta', { metaId: responseData.id, name });
      return json({ success: true, metaTemplateId: responseData.id, status: responseData.status });
    }

    // ========================================
    // DELETE — Remove template from Meta
    // ========================================
    if (method === 'DELETE') {
      const body = await req.json();
      const { name, localTemplateId } = body;

      if (!name) return json({ error: 'name required' }, 400);

      const res = await fetch(
        `${META_BASE}/${config.metaBusinessAccountId}/message_templates?name=${encodeURIComponent(name)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${config.metaAccessToken}` },
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Meta API ${res.status}: ${err}` }, res.status);
      }

      // Reset local status
      if (localTemplateId) {
        await supabase
          .from('message_templates')
          .update({
            meta_template_id: null,
            meta_status: 'LOCAL',
            meta_rejected_reason: null,
          })
          .eq('id', localTemplateId);
      }

      return json({ success: true });
    }

    // ========================================
    // PATCH — Sync statuses from Meta to local
    // ========================================
    if (method === 'PATCH') {
      // Fetch all Meta templates
      const res = await fetch(
        `${META_BASE}/${config.metaBusinessAccountId}/message_templates?limit=250`,
        { headers: { Authorization: `Bearer ${config.metaAccessToken}` } }
      );

      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Meta API ${res.status}: ${err}` }, res.status);
      }

      const metaData = await res.json();
      const metaTemplates = metaData.data || [];

      // Build map: name -> meta info
      const metaMap = new Map<string, { id: string; status: string; rejected_reason?: string; category?: string; components?: unknown[] }>();
      for (const mt of metaTemplates) {
        metaMap.set(mt.name, {
          id: mt.id,
          status: mt.status,
          rejected_reason: mt.rejected_reason,
          category: mt.category,
          components: mt.components,
        });
      }

      // Get local templates for this empresa that have been submitted
      const { data: locals } = await supabase
        .from('message_templates')
        .select('id, codigo, meta_template_id, meta_status')
        .eq('empresa', empresa)
        .neq('meta_status', 'LOCAL');

      let synced = 0;
      for (const local of (locals || [])) {
        const meta = metaMap.get(local.codigo);
        if (meta) {
          const newStatus = meta.status?.toUpperCase() || 'PENDING';
          if (newStatus !== local.meta_status) {
            await supabase
              .from('message_templates')
              .update({
                meta_template_id: meta.id,
                meta_status: newStatus,
                meta_rejected_reason: meta.rejected_reason || null,
                meta_category: meta.category || null,
                meta_components: meta.components || null,
              })
              .eq('id', local.id);
            synced++;
          }
        }
      }

      log.info('Sync completed', { empresa, synced, metaTotal: metaTemplates.length });
      return json({ success: true, synced, metaTotal: metaTemplates.length });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
