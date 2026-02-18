// ========================================
// _shared/empresa-mapping.ts — Normaliza nomes de empresa do Blue Chat
// ========================================

import type { EmpresaTipo } from "./types.ts";

/**
 * Map of Blue Chat company names (lowercase) to internal enum values.
 * Blue Chat sends human-readable names; we normalize to our enum.
 */
const BLUECHAT_EMPRESA_MAP: Record<string, EmpresaTipo> = {
  'tokeniza': 'TOKENIZA',
  'blue': 'BLUE',
  'blue consult': 'BLUE',
  'blue cripto': 'BLUE',
  'mpuppe': 'MPUPPE',
  'axia': 'AXIA',
};

/**
 * Normalizes a raw empresa string from Blue Chat payload to internal EmpresaTipo.
 * Falls back to 'BLUE' if unrecognized.
 */
export function mapBluechatEmpresa(raw?: string | null): EmpresaTipo {
  if (!raw) return 'BLUE';
  const key = raw.trim().toLowerCase();
  return BLUECHAT_EMPRESA_MAP[key] || 'BLUE';
}
