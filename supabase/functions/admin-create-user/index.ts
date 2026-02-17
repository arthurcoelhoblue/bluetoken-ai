import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.25.76'
import { envConfig, createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('admin-create-user');

const createUserPayload = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  nome: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  access_profile_id: z.string().uuid().optional(),
  empresa: z.string().optional(),
  gestor_id: z.string().uuid().optional(),
  is_vendedor: z.boolean().optional(),
  ramal: z.string().optional(),
})

import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerClient = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: hasAdmin } = await callerClient.rpc('has_role', { _user_id: caller.id, _role: 'ADMIN' })
    if (!hasAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas ADMINs podem criar usuários.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.json()
    const parsed = createUserPayload.safeParse(rawBody)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0]?.message || 'Dados inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, nome, password, access_profile_id, empresa, gestor_id, is_vendedor, ramal } = parsed.data
    const adminClient = createServiceClient()
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nome },
    })

    if (createError) {
      log.error('Error creating user', { error: createError.message })
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (newUser.user && (gestor_id || is_vendedor)) {
      const profileUpdates: Record<string, unknown> = {}
      if (gestor_id) profileUpdates.gestor_id = gestor_id
      if (is_vendedor) profileUpdates.is_vendedor = true
      const { error: profileError } = await adminClient.from('profiles').update(profileUpdates).eq('id', newUser.user.id)
      if (profileError) log.error('Error updating profile', { error: profileError.message })
    }

    if (access_profile_id && newUser.user) {
      const { error: assignError } = await adminClient.from('user_access_assignments').insert({
        user_id: newUser.user.id, access_profile_id,
        empresa: empresa === 'all' ? null : empresa, assigned_by: caller.id,
      })
      if (assignError) log.error('Error assigning profile', { error: assignError.message })
    }

    // Insert ramal (zadarma extension) if provided
    if (ramal && newUser.user) {
      const extEmpresa = empresa && empresa !== 'all' ? empresa : 'BLUE'
      const { error: ramalError } = await adminClient.from('zadarma_extensions').insert({
        user_id: newUser.user.id, extension_number: ramal, empresa: extEmpresa,
      })
      if (ramalError) log.error('Error inserting ramal', { error: ramalError.message })
    }

    return new Response(JSON.stringify({ success: true, user: { id: newUser.user?.id, email: newUser.user?.email } }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    log.error('Unexpected error', { error: err instanceof Error ? err.message : String(err) })
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
