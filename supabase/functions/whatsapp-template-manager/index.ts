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
    const connectionId = url.searchParams.get('connectionId');

    if (!empresa) return json({ error: 'empresa query param required' }, 400);

    // Resolve Meta credentials — prefer specific connection if provided
    const config = connectionId
      ? await resolveMetaCloudConfig(supabase, empresa, connectionId)
      : await resolveMetaCloudConfig(supabase, empresa);
    if (config.mode !== 'META_CLOUD' || !config.metaAccessToken || !config.metaBusinessAccountId) {
      return json({ error: `Meta Cloud não configurado para ${empresa}` }, 400);
    }

    const method = req.method;

    // ========================================
    // GET — List templates from Meta
    // ========================================
    if (method === 'GET') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(
          `${META_BASE}/${config.metaBusinessAccountId}/message_templates?limit=100`,
          { headers: { Authorization: `Bearer ${config.metaAccessToken}` }, signal: controller.signal }
        );
        clearTimeout(timeout);
        if (!res.ok) {
          const err = await res.text();
          log.error('Meta list error', { status: res.status, err });
          return json({ error: `Meta API ${res.status}: ${err}` }, res.status);
        }
        const data = await res.json();
        return json({ templates: data.data || [], paging: data.paging });
      } catch (e) {
        clearTimeout(timeout);
        log.error('Meta GET timeout/error', { error: e instanceof Error ? e.message : String(e) });
        return json({ error: 'Meta API timeout or network error' }, 504);
      }
    }

    // ========================================
    // POST — Create template on Meta + sync local
    //   ?action=batch-submit → batch submit all LOCAL templates
    // ========================================
    if (method === 'POST') {
      const action = url.searchParams.get('action');

      // Batch submit all LOCAL templates
      if (action === 'batch-submit') {
        log.info('Batch submit started', { empresa });

        let batchQuery = supabase
          .from('message_templates')
          .select('id, codigo, nome, conteudo, canal, meta_category, meta_language, meta_components')
          .eq('empresa', empresa)
          .eq('meta_status', 'LOCAL')
          .eq('canal', 'WHATSAPP')
          .eq('ativo', true);
        if (connectionId) batchQuery = batchQuery.eq('connection_id', connectionId);
        const { data: locals, error: fetchErr } = await batchQuery;

        if (fetchErr) return json({ error: fetchErr.message }, 500);
        if (!locals || locals.length === 0) return json({ success: true, message: 'No LOCAL templates', submitted: 0, failed: 0 });

        log.info('Found LOCAL templates', { count: locals.length });
        const batchResults: Array<{ codigo: string; success: boolean; metaId?: string; error?: string }> = [];

        for (const tpl of locals) {
          try {
            const metaName = tpl.codigo.toLowerCase();
            const category = (tpl.meta_category as string) || 'MARKETING';
            const language = (tpl.meta_language as string) || 'pt_BR';

            // If meta_components is stored, use them directly (already formatted)
            let comps: unknown[];
            if (tpl.meta_components && Array.isArray(tpl.meta_components) && (tpl.meta_components as unknown[]).length > 0) {
              // Use stored components — normalize BODY variables
              comps = (tpl.meta_components as Array<Record<string, unknown>>).map((comp: Record<string, unknown>) => {
                if (comp.type !== 'BODY' || typeof comp.text !== 'string') return comp;
                let rawText = comp.text as string;
                if (/^\{\{/.test(rawText)) rawText = 'Olá ' + rawText;
                if (/\{\{[^}]+\}\}\s*[.!?,;:]?\s*$/.test(rawText)) rawText = rawText.replace(/(\{\{[^}]+\}\})\s*[.!?,;:]?\s*$/, '$1. Fico à disposição.');
                const varMap: Record<string, number> = {};
                let vc = 0;
                const bodyText = rawText.replace(/\{\{(\w+)\}\}/g, (_m: string, vn: string) => {
                  if (!(vn in varMap)) { vc++; varMap[vn] = vc; }
                  return `{{${varMap[vn]}}}`;
                });
                const exVals = Array(vc).fill('Cliente');
                return { ...comp, text: bodyText, ...(vc > 0 ? { example: { body_text: [exVals] } } : {}) };
              });
            } else {
              // Fallback: build BODY-only component from conteudo
              let rawText = tpl.conteudo as string;
              if (/^\{\{/.test(rawText)) rawText = 'Olá ' + rawText;
              if (/\{\{[^}]+\}\}\s*[.!?,;:]?\s*$/.test(rawText)) rawText = rawText.replace(/(\{\{[^}]+\}\})\s*[.!?,;:]?\s*$/, '$1. Fico à disposição.');
              const varMap: Record<string, number> = {};
              let varCounter = 0;
              const bodyText = rawText.replace(/\{\{(\w+)\}\}/g, (_m: string, varName: string) => {
                if (!(varName in varMap)) { varCounter++; varMap[varName] = varCounter; }
                return `{{${varMap[varName]}}}`;
              });
              const exampleValues = Array(varCounter).fill('Cliente');
              comps = [{ type: 'BODY', text: bodyText, ...(varCounter > 0 ? { example: { body_text: [exampleValues] } } : {}) }];
            }

            const res = await fetch(`${META_BASE}/${config.metaBusinessAccountId}/message_templates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.metaAccessToken}` },
              body: JSON.stringify({ name: metaName, category, language, components: comps }),
            });
            const resData = await res.json();

            if (!res.ok) {
              log.error('Meta submit failed', { metaName, status: res.status, resData });
              batchResults.push({ codigo: tpl.codigo, success: false, error: resData?.error?.message || `HTTP ${res.status}` });
              continue;
            }

            await supabase.from('message_templates').update({
              meta_template_id: resData.id, meta_status: resData.status || 'PENDING',
              meta_category: category, meta_language: language, meta_components: comps,
            }).eq('id', tpl.id);

            batchResults.push({ codigo: tpl.codigo, success: true, metaId: resData.id });
            log.info('Template submitted', { metaName, metaId: resData.id });
            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            batchResults.push({ codigo: tpl.codigo, success: false, error: e instanceof Error ? e.message : String(e) });
          }
        }

        const submitted = batchResults.filter((r) => r.success).length;
        const failed = batchResults.filter((r) => !r.success).length;
        log.info('Batch completed', { empresa, submitted, failed });
        return json({ success: true, submitted, failed, results: batchResults });
      }

      const body = await req.json();
      const { name, category, language, components, localTemplateId } = body;

      if (!name || !category || !components) {
        return json({ error: 'name, category, components required' }, 400);
      }

      // Normalize components: convert named variables to numbered format
      const normalizedComponents = (components as Array<Record<string, unknown>>).map((comp: Record<string, unknown>) => {
        if (comp.type !== 'BODY' || typeof comp.text !== 'string') return comp;

        let rawText = comp.text as string;

        // Meta doesn't allow variables at the very start or end
        if (/^\{\{/.test(rawText)) {
          rawText = 'Olá ' + rawText;
        }
        if (/\{\{[^}]+\}\}\s*$/.test(rawText)) {
          rawText = rawText.trimEnd() + '.';
        }

        const varMap: Record<string, number> = {};
        let varCounter = 0;
        const bodyText = rawText.replace(
          /\{\{(\w+)\}\}/g,
          (_m: string, varName: string) => {
            // If already numeric, keep as-is but track
            if (!(varName in varMap)) { varCounter++; varMap[varName] = varCounter; }
            return `{{${varMap[varName]}}}`;
          }
        );
        const exampleValues = Array(varCounter).fill('Cliente');
        return {
          ...comp,
          text: bodyText,
          ...(varCounter > 0 ? { example: { body_text: [exampleValues] } } : {}),
        };
      });

      const metaPayload = {
        name,
        category,
        language: language || 'pt_BR',
        components: normalizedComponents,
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
      log.info('PATCH sync started', { empresa, connectionId });

      // Helper: sync templates for a single connection/WABA
      async function syncOneConnection(
        connConfig: ChannelConfig,
        connId: string | null,
      ): Promise<{ synced: number; metaTotal: number; unmatched: string[] }> {
        if (connConfig.mode !== 'META_CLOUD' || !connConfig.metaAccessToken || !connConfig.metaBusinessAccountId) {
          log.warn('Skipping connection without Meta credentials', { connId });
          return { synced: 0, metaTotal: 0, unmatched: [] };
        }

        // Fetch Meta templates for this WABA
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        let res: Response;
        try {
          res = await fetch(
            `${META_BASE}/${connConfig.metaBusinessAccountId}/message_templates?limit=250`,
            { headers: { Authorization: `Bearer ${connConfig.metaAccessToken}` }, signal: controller.signal }
          );
          clearTimeout(timeout);
        } catch (e) {
          clearTimeout(timeout);
          log.error('Meta PATCH fetch timeout/error', { connId, error: e instanceof Error ? e.message : String(e) });
          return { synced: 0, metaTotal: 0, unmatched: [] };
        }

        if (!res.ok) {
          const err = await res.text();
          log.error('Meta PATCH list error', { connId, status: res.status, err });
          return { synced: 0, metaTotal: 0, unmatched: [] };
        }

        const metaData = await res.json();
        const metaTemplates = metaData.data || [];
        log.info('Meta templates fetched', { connId, count: metaTemplates.length });

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

        // Get local templates for this connection that have been submitted
        let syncQuery = supabase
          .from('message_templates')
          .select('id, codigo, meta_template_id, meta_status')
          .eq('empresa', empresa)
          .neq('meta_status', 'LOCAL');
        if (connId) {
          syncQuery = syncQuery.eq('connection_id', connId);
        }
        const { data: locals } = await syncQuery;

        let synced = 0;
        const unmatched: string[] = [];
        for (const local of (locals || [])) {
          const codigoLower = local.codigo.toLowerCase();
          // Try exact match first, then fallback stripping clone suffix
          let meta = metaMap.get(codigoLower);
          if (!meta) {
            const stripped = codigoLower.replace(/_[a-f0-9]{4,}$/, '');
            if (stripped !== codigoLower) {
              meta = metaMap.get(stripped);
              if (meta) log.info('Matched via fallback (stripped suffix)', { codigo: local.codigo, strippedTo: stripped });
            }
          }

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
          } else {
            unmatched.push(local.codigo);
          }
        }

        if (unmatched.length > 0) {
          log.warn('Templates not found in Meta', { connId, unmatched });
        }

        return { synced, metaTotal: metaTemplates.length, unmatched };
      }

      // If connectionId is provided, sync only that connection
      if (connectionId) {
        const result = await syncOneConnection(config, connectionId);
        log.info('Sync completed (single connection)', { empresa, connectionId, ...result });
        return json({ success: true, synced: result.synced, metaTotal: result.metaTotal, unmatched: result.unmatched });
      }

      // No connectionId — iterate ALL active connections for this empresa
      const { data: allConns } = await supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('empresa', empresa)
        .eq('is_active', true);

      if (!allConns || allConns.length === 0) {
        log.info('No active connections found', { empresa });
        return json({ success: true, synced: 0, metaTotal: 0, message: 'No active connections' });
      }

      let totalSynced = 0;
      let totalMeta = 0;
      const allUnmatched: string[] = [];

      for (const conn of allConns) {
        const connConfig = await resolveMetaCloudConfig(supabase, empresa, conn.id);
        const result = await syncOneConnection(connConfig, conn.id);
        totalSynced += result.synced;
        totalMeta += result.metaTotal;
        allUnmatched.push(...result.unmatched);
      }

      log.info('Sync completed (all connections)', { empresa, totalSynced, totalMeta, connectionsChecked: allConns.length });
      return json({ success: true, synced: totalSynced, metaTotal: totalMeta, connectionsChecked: allConns.length, unmatched: allUnmatched });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
