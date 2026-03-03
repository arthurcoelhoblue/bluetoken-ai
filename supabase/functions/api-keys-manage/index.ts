// api-keys-manage — CRUD de API keys para admins autenticados
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { hashApiKey } from "../_shared/api-key-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  try {
    // Auth: require authenticated admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id, _role: "ADMIN",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const method = req.method;

    // GET: list keys for empresa
    if (method === "GET") {
      const empresa = url.searchParams.get("empresa");
      let query = supabaseAdmin.from("api_keys")
        .select("id, empresa, label, key_preview, permissions, is_active, expires_at, last_used_at, created_at")
        .order("created_at", { ascending: false });

      if (empresa) query = query.eq("empresa", empresa);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // POST: create new key
    if (method === "POST") {
      const body = await req.json();
      const { empresa, label, permissions, expires_at } = body;

      if (!empresa || !label) {
        return new Response(JSON.stringify({ error: "empresa e label são obrigatórios" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Generate raw key
      const rawKey = crypto.randomUUID();
      const keyHash = await hashApiKey(rawKey);
      const keyPreview = rawKey.slice(-8);

      const { data, error } = await supabaseAdmin.from("api_keys").insert({
        empresa,
        label,
        key_hash: keyHash,
        key_preview: keyPreview,
        permissions: permissions || ["lead:write", "meta:read"],
        created_by: user.id,
        expires_at: expires_at || null,
      }).select("id, empresa, label, key_preview, permissions, created_at").single();

      if (error) throw error;

      // Return raw key ONLY on creation
      return new Response(JSON.stringify({ ...data, raw_key: rawKey }), {
        status: 201, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // PATCH: revoke/activate key
    if (method === "PATCH") {
      const body = await req.json();
      const { id, is_active } = body;

      if (!id || typeof is_active !== "boolean") {
        return new Response(JSON.stringify({ error: "id e is_active são obrigatórios" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.from("api_keys")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // DELETE: remove key
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id é obrigatório" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.from("api_keys").delete().eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
