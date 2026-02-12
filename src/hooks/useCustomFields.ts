import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CustomFieldDefinition, CustomFieldValue, CustomFieldEntityType, CustomFieldFormData } from '@/types/customFields';

export function useCustomFieldDefinitions(entityType?: CustomFieldEntityType) {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['custom_field_definitions', activeCompany, entityType],
    queryFn: async (): Promise<CustomFieldDefinition[]> => {
      let query = supabase
        .from('custom_field_definitions')
        .select('*')
        .order('posicao', { ascending: true });

      if (activeCompany !== 'all') {
        query = query.eq('empresa', activeCompany.toUpperCase() as 'BLUE' | 'TOKENIZA');
      }
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CustomFieldDefinition[];
    },
  });
}

export function useAllFieldDefinitions() {
  return useQuery({
    queryKey: ['custom_field_definitions', 'all'],
    queryFn: async (): Promise<CustomFieldDefinition[]> => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('empresa')
        .order('entity_type')
        .order('posicao', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as CustomFieldDefinition[];
    },
  });
}

export function useCreateFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CustomFieldFormData) => {
      const { error } = await supabase.from('custom_field_definitions').insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom_field_definitions'] }),
  });
}

export function useUpdateFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CustomFieldFormData> & { id: string }) => {
      const { error } = await supabase.from('custom_field_definitions').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom_field_definitions'] }),
  });
}

export function useDeleteFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom_field_definitions'] }),
  });
}

export function useCustomFieldValues(entityType: CustomFieldEntityType, entityId: string | null) {
  return useQuery({
    queryKey: ['custom_field_values', entityType, entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<CustomFieldValue[]> => {
      const { data, error } = await supabase
        .from('custom_field_values')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId!);

      if (error) throw error;
      return (data ?? []) as unknown as CustomFieldValue[];
    },
  });
}

export function useUpsertFieldValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      field_id: string;
      entity_type: CustomFieldEntityType;
      entity_id: string;
      value_text?: string | null;
      value_number?: number | null;
      value_boolean?: boolean | null;
      value_date?: string | null;
      value_json?: unknown | null;
    }) => {
      const { error } = await supabase
        .from('custom_field_values')
        .upsert(data as any, { onConflict: 'field_id,entity_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom_field_values'] }),
  });
}
