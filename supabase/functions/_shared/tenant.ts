// ========================================
// _shared/tenant.ts — Tenant isolation helpers for Edge Functions
// ========================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EmpresaTipo = 'TOKENIZA' | 'BLUE' | 'MPUPPE' | 'AXIA';

const VALID_EMPRESAS: ReadonlySet<string> = new Set(['TOKENIZA', 'BLUE', 'MPUPPE', 'AXIA']);

/** All tenant identifiers for batch iteration (forEachEmpresa pattern) */
export const EMPRESAS: readonly EmpresaTipo[] = ['BLUE', 'TOKENIZA', 'MPUPPE', 'AXIA'] as const;

/**
 * Validates that the given value is a valid tenant identifier.
 * Throws if invalid.
 */
export function assertEmpresa(empresa: unknown): asserts empresa is EmpresaTipo {
  if (typeof empresa !== 'string' || !VALID_EMPRESAS.has(empresa)) {
    throw new Error(`Tenant inválido: "${empresa}". Esperado: BLUE, TOKENIZA, MPUPPE ou AXIA.`);
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
  // 1. Try from body
  if (body?.empresa && typeof body.empresa === 'string' && VALID_EMPRESAS.has(body.empresa)) {
    return body.empresa as EmpresaTipo;
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
      if (assignment?.empresa && VALID_EMPRESAS.has(assignment.empresa)) {
        return assignment.empresa as EmpresaTipo;
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
  // 1. Try from body.empresas (array)
  if (Array.isArray(body?.empresas)) {
    const valid = (body.empresas as string[]).filter(e => VALID_EMPRESAS.has(e)) as EmpresaTipo[];
    if (valid.length > 0) return valid;
  }

  // 2. Try from body.empresa (single)
  if (body?.empresa && typeof body.empresa === 'string' && VALID_EMPRESAS.has(body.empresa)) {
    return [body.empresa as EmpresaTipo];
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
          .map(a => a.empresa)
          .filter(e => e && VALID_EMPRESAS.has(e)) as EmpresaTipo[];
        if (empresas.length > 0) return empresas;
      }
    }
  }

  throw new Error('empresa(s) é obrigatório (no body ou via token de autenticação).');
}