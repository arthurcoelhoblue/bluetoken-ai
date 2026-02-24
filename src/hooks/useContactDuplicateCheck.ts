import { supabase } from '@/integrations/supabase/client';

export interface DuplicateMatch {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
}

export async function checkContactDuplicates({
  email,
  telefone,
  empresa,
}: {
  email?: string;
  telefone?: string;
  empresa: 'BLUE' | 'TOKENIZA' | 'AXIA' | 'MPUPPE';
}): Promise<DuplicateMatch[]> {
  const trimmedEmail = email?.trim().toLowerCase();
  const trimmedPhone = telefone?.trim();

  if (!trimmedEmail && !trimmedPhone) return [];

  const orFilters: string[] = [];
  if (trimmedEmail) orFilters.push(`email.ilike.${trimmedEmail}`);
  if (trimmedPhone) orFilters.push(`telefone.ilike.%${trimmedPhone}%`);

  const { data, error } = await supabase
    .from('contacts')
    .select('id, nome, email, telefone')
    .eq('empresa', empresa)
    .eq('is_active', true)
    .or(orFilters.join(','))
    .limit(5);

  if (error) {
    console.error('Duplicate check error:', error);
    return [];
  }

  return (data ?? []) as DuplicateMatch[];
}
