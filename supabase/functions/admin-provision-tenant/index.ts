import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is ADMIN
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleCheck } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'ADMIN',
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { empresa_id } = await req.json();
    if (!empresa_id || typeof empresa_id !== 'string') {
      return new Response(JSON.stringify({ error: 'empresa_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = empresa_id.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const steps: string[] = [];

    // Step 1: Try to add value to enum (may already exist)
    try {
      await supabase.rpc('exec_sql' as any, {
        query: `ALTER TYPE empresa_tipo ADD VALUE IF NOT EXISTS '${normalized}'`,
      }).throwOnError();
      steps.push('enum_added');
    } catch (enumErr: any) {
      // Fallback: use raw SQL via service role connection
      // ALTER TYPE ... ADD VALUE IF NOT EXISTS won't error in PG 9.3+
      // If rpc doesn't exist, try direct approach
      console.warn('enum add via rpc failed, trying direct:', enumErr.message);
      
      // We'll use a different approach - execute via pg directly
      const pgUrl = Deno.env.get('SUPABASE_DB_URL');
      if (pgUrl) {
        try {
          // Use the postgres module available in Deno
          const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
          const sql = postgres(pgUrl);
          await sql.unsafe(`ALTER TYPE empresa_tipo ADD VALUE IF NOT EXISTS '${normalized}'`);
          await sql.end();
          steps.push('enum_added_direct');
        } catch (directErr: any) {
          console.warn('Direct enum add failed:', directErr.message);
          steps.push('enum_skipped: ' + directErr.message);
        }
      } else {
        steps.push('enum_skipped: no DB URL');
      }
    }

    // Step 2: Provision tenant schema
    try {
      await supabase.rpc('provision_tenant_schema', {
        tenant_empresa: normalized,
      });
      steps.push('schema_provisioned');
    } catch (schemaErr: any) {
      steps.push('schema_error: ' + schemaErr.message);
    }

    return new Response(JSON.stringify({ success: true, empresa_id: normalized, steps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('admin-provision-tenant error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
