// ========================================
// _shared/tenant.ts — Tenant isolation helpers for Edge Functions
// ========================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EmpresaTipo = string;

// Cache of valid empresas loaded from DB
let _cachedEmpresas: Set<string> | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Loads valid empresas from the `empresas` table (with cache).
 */
async function loadValidEmpresas(supabase: SupabaseClient): Promise<Set<string>> {
  const now = Date.now();
  if (_cachedEmpresas && (now - _cacheTime) < CACHE_TTL_MS) {
    return _cachedEmpresas;
  }

  const { data, error } = await supabase
    .from('empresas')
    .select('id')
    .eq('is_active', true);

  if (error || !data) {
    console.error('Failed to load empresas from DB:', error?.message);
    // Fallback to known empresas if DB fails
    _cachedEmpresas = new Set(['BLUE', 'TOKENIZA', 'MPUPPE', 'AXIA']);
  } else {
    _cachedEmpresas = new Set(data.map(e => e.id));
  }
  _cacheTime = now;
  return _cachedEmpresas;
}

/** Clears the empresas cache (useful after adding a new tenant) */
export function clearEmpresaCache(): void {
  _cachedEmpresas = null;
  _cacheTime = 0;
}

/**
 * All tenant identifiers for batch iteration (forEachEmpresa pattern).
 * Loads from DB on first call.
 */
export async function getEmpresas(supabase: SupabaseClient): Promise<string[]> {
  const set = await loadValidEmpresas(supabase);
  return Array.from(set);
}

// Backward-compat: static EMPRESAS array for functions that import it directly
// Will be used as fallback only — functions should prefer getEmpresas()
export const EMPRESAS: readonly string[] = ['BLUE', 'TOKENIZA', 'MPUPPE', 'AXIA'] as const;

/**
 * Validates that the given value is a valid tenant identifier.
 * Uses static set for sync validation (backward compat).
 * For dynamic validation, use assertEmpresaAsync.
 */
export function assertEmpresa(empresa: unknown): asserts empresa is EmpresaTipo {
  if (typeof empresa !== 'string' || empresa.length === 0) {
    throw new Error(`Tenant inválido: "${empresa}".`);
  }
  // Accept any non-empty string — the DB is the source of truth
  // Individual edge functions can use assertEmpresaAsync for strict validation
}

/**
 * Validates empresa against the DB table.
 */
export async function assertEmpresaAsync(empresa: unknown, supabase: SupabaseClient): Promise<void> {
  if (typeof empresa !== 'string' || empresa.length === 0) {
    throw new Error(`Tenant inválido: "${empresa}".`);
  }
  const valid = await loadValidEmpresas(supabase);
  if (!valid.has(empresa)) {
    throw new Error(`Tenant inválido: "${empresa}". Esperado: ${Array.from(valid).join(', ')}.`);
  }
}

/**
 * Validates and returns an array of valid tenant identifiers.
 */
export function assertEmpresas(empresas: unknown): EmpresaTipo[] {
  if (!Array.isArray(empresas) || empresas.length === 0) {
    throw new Error('empresas deve ser um array não-vazio de tenants válidos.');
  }
  for (const e of empresas) {
    assertEmpresa(e);
  }
  return empresas as EmpresaTipo[];
}

/**
 * Extracts empresa from the request body or JWT token.
 * Priority: body.empresa > JWT user metadata > error
 */
export async function extractEmpresa(
  body: Record<string, unknown>,
  supabase: SupabaseClient,
  authHeader?: string | null,
): Promise<EmpresaTipo> {
  const validSet = await loadValidEmpresas(supabase);

  // 1. Try from body
  if (body?.empresa && typeof body.empresa === 'string' && validSet.has(body.empresa)) {
    return body.empresa;
  }

  // 2. Try from JWT via user_access_assignments
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userId) {
      const { data: assignment } = await supabase
        .from('user_access_assignments')
        .select('empresa')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (assignment?.empresa && validSet.has(String(assignment.empresa))) {
        return String(assignment.empresa);
      }
    }
  }

  throw new Error('empresa é obrigatório (no body ou via token de autenticação).');
}

/**
 * Extracts multiple empresas from the request body or JWT token.
 * Priority: body.empresas (array) > body.empresa (single) > JWT > error
 */
export async function extractEmpresas(
  body: Record<string, unknown>,
  supabase: SupabaseClient,
  authHeader?: string | null,
): Promise<EmpresaTipo[]> {
  const validSet = await loadValidEmpresas(supabase);

  // 1. Try from body.empresas (array)
  if (Array.isArray(body?.empresas)) {
    const valid = (body.empresas as string[]).filter(e => validSet.has(e));
    if (valid.length > 0) return valid;
  }

  // 2. Try from body.empresa (single)
  if (body?.empresa && typeof body.empresa === 'string' && validSet.has(body.empresa)) {
    return [body.empresa];
  }

  // 3. Try from JWT via user_access_assignments (all assigned companies)
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userId) {
      const { data: assignments } = await supabase
        .from('user_access_assignments')
        .select('empresa')
        .eq('user_id', userId);
      if (assignments && assignments.length > 0) {
        const empresas = assignments
          .map(a => String(a.empresa))
          .filter(e => e && validSet.has(e));
        if (empresas.length > 0) return empresas;
      }
    }
  }

  throw new Error('empresa(s) é obrigatório (no body ou via token de autenticação).');
}
