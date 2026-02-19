// ========================================
// _shared/name-sanitizer.ts — Limpeza de nomes com tags de campanha
// ========================================

export interface CleanNameResult {
  name: string;
  campaigns: string[];
}

/**
 * Remove tags de campanha entre colchetes do nome e extrai como metadado.
 * 
 * Exemplos:
 * - `[ir-no-prazo] - David` → { name: 'David', campaigns: ['ir-no-prazo'] }
 * - `[Renovacao 2026] - Rogerio Machado` → { name: 'Rogerio Machado', campaigns: ['Renovacao 2026'] }
 * - `Caio Campos Thomaz [Renovacao]` → { name: 'Caio Campos Thomaz', campaigns: ['Renovacao'] }
 * - `Éttore Mantovani Bottura[Renovacao 2026]` → { name: 'Éttore Mantovani Bottura', campaigns: ['Renovacao 2026'] }
 */
export function cleanContactName(rawName: string): CleanNameResult {
  if (!rawName) return { name: rawName, campaigns: [] };

  const campaigns: string[] = [];
  
  // Extrair tags entre colchetes
  const tagRegex = /\[([^\]]+)\]/g;
  let match;
  while ((match = tagRegex.exec(rawName)) !== null) {
    campaigns.push(match[1].trim());
  }
  
  // Remover tags do nome
  let name = rawName.replace(/\[[^\]]*\]/g, '');
  
  // Remover separadores órfãos no início/fim
  name = name.replace(/^\s*-\s*/, '').replace(/\s*-\s*$/, '');
  
  // Remover anos soltos no fim (ex: "- 2026", "- B1")
  name = name.replace(/\s*-\s*\d{4}\s*$/g, '');
  name = name.replace(/\s*-\s*[A-Z]\d+\s*$/gi, '');
  
  // Remover "(cópia)" e variantes
  name = name.replace(/\(c[oó]pia\)/gi, '');
  
  // Normalizar espaços
  name = name.replace(/\s{2,}/g, ' ').trim();
  
  // Fallback: se ficou vazio, usar o original
  return { name: name || rawName.trim(), campaigns };
}

/**
 * Detecta se o nome/campanhas indicam um lead de renovação.
 */
export function isRenewalLead(campaigns: string[], stage?: string | null): boolean {
  const hasRenewalTag = campaigns.some(c => 
    /renovac[aã]o/i.test(c)
  );
  const isClienteStage = stage === 'Cliente';
  return hasRenewalTag || isClienteStage;
}
