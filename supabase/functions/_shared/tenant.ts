// ========================================
// _shared/tenant.ts — Tenant isolation helpers for Edge Functions
// ========================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EmpresaTipo = 'TOKENIZA' | 'BLUE';

const VALID_EMPRESAS: ReadonlySet<string> = new Set(['TOKENIZA', 'BLUE']);

/** All tenant identifiers for batch iteration (forEachEmpresa pattern) */
export const EMPRESAS: readonly EmpresaTipo[] = ['BLUE', 'TOKENIZA'] as const;

/**
 * Validates that the given value is a valid tenant identifier.
 * Throws if invalid.
 */
export function assertEmpresa(empresa: unknown): asserts empresa is EmpresaTipo {
  if (typeof empresa !== 'string' || !VALID_EMPRESAS.has(empresa)) {
    throw new Error(`Tenant inválido: "${empresa}". Esperado: BLUE ou TOKENIZA.`);
  }
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
