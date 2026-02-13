import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { CustomFieldDefinition, CustomFieldValue, CustomFieldEntityType, CustomFieldFormData, ResolvedCustomField } from '@/types/customFields';

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

export function useResolvedFields(entityType: CustomFieldEntityType, entityId: string | null): ResolvedCustomField[] {
  const { data: definitions } = useCustomFieldDefinitions(entityType);
  const { data: values } = useCustomFieldValues(entityType, entityId);

  if (!definitions) return [];

  const valueMap = new Map<string, CustomFieldValue>();
  values?.forEach((v) => valueMap.set(v.field_id, v));

  return definitions
    .filter((d) => d.is_visible)
    .map((def) => {
      const val = valueMap.get(def.id) ?? null;
      let displayValue = '—';

      if (val) {
        const vt = def.value_type;
        if (['TEXT', 'EMAIL', 'PHONE', 'URL', 'TAG', 'TEXTAREA', 'SELECT'].includes(vt) && val.value_text) {
          displayValue = val.value_text;
        } else if (['NUMBER', 'PERCENT'].includes(vt) && val.value_number != null) {
          displayValue = String(val.value_number);
        } else if (vt === 'CURRENCY' && val.value_number != null) {
          displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val.value_number);
        } else if (vt === 'BOOLEAN' && val.value_boolean != null) {
          displayValue = val.value_boolean ? 'Sim' : 'Não';
        } else if (['DATE', 'DATETIME'].includes(vt) && val.value_date) {
          displayValue = new Date(val.value_date).toLocaleDateString('pt-BR');
        } else if (vt === 'MULTISELECT' && val.value_text) {
          displayValue = val.value_text;
        }
      }

      return { definition: def, value: val, displayValue };
    });
}
