import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DealTagsEditor } from '@/components/deals/DealTagsEditor';
import { DealAssociations } from '@/components/deals/DealAssociations';
import type { DealFullDetail } from '@/types/deal';
import type { UseMutationResult } from '@tanstack/react-query';

interface DealDadosTabProps {
  deal: DealFullDetail;
  updateField: UseMutationResult<unknown, Error, { dealId: string; field: string; value: unknown }>;
  onContactClick?: (contactId: string) => void;
  onOrgClick?: (orgId: string) => void;
}

function useVendedores() {
  return useQuery({
    queryKey: ['vendedores-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('is_active', true)
        .eq('is_vendedor', true)
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function DealDadosTab({ deal, updateField, onContactClick, onOrgClick }: DealDadosTabProps) {
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const { data: vendedores = [] } = useVendedores();

  const startEdit = (field: string, value: string) => { setEditField(field); setEditValue(value || ''); };
  const saveEdit = () => {
    if (!editField) return;
    updateField.mutate({ dealId: deal.id, field: editField, value: editValue || null }, {
      onSuccess: () => { toast.success('Atualizado'); setEditField(null); },
    });
  };

  const handleOwnerChange = (ownerId: string) => {
    const ownerName = vendedores.find(v => v.id === ownerId)?.nome || ownerId;
    updateField.mutate({ dealId: deal.id, field: 'owner_id', value: ownerId }, {
      onSuccess: async () => {
        toast.success(`Transferido para ${ownerName}`);
        await supabase.from('deal_activities').insert({
          deal_id: deal.id,
          tipo: 'NOTA',
          descricao: `🔄 Transferido para ${ownerName}`,
        });
      },
    });
  };

  const renderInlineField = (label: string, field: string, value: string | null) => {
    const isEditing = editField === field;
    return (
      <div className="group flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">{label}</span>
          {isEditing ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit()} />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditField(null)}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <p className="text-sm truncate">{value || '—'}</p>
          )}
        </div>
        {!isEditing && (
          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => startEdit(field, value || '')}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="px-6 mt-3 space-y-4">
      {/* Associações de Contato e Organização */}
      <DealAssociations
        deal={deal}
        updateField={updateField}
        onContactClick={onContactClick}
        onOrgClick={onOrgClick}
      />

      <div className="space-y-1">
      {renderInlineField('Título', 'titulo', deal.titulo)}
      {renderInlineField('Valor', 'valor', String(deal.valor ?? 0))}

      {/* Responsável — Select de vendedores */}
      <div className="group flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">Responsável</span>
          <Select value={deal.owner_id ?? ''} onValueChange={handleOwnerChange}>
            <SelectTrigger className="h-7 text-sm mt-0.5">
              <SelectValue placeholder="Selecionar vendedor" />
            </SelectTrigger>
            <SelectContent>
              {vendedores.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.nome || v.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {renderInlineField('Temperatura', 'temperatura', deal.temperatura)}
      {renderInlineField('Canal de origem', 'canal_origem', deal.canal_origem)}
      {renderInlineField('Notas', 'notas', deal.notas)}
      {renderInlineField('Etiqueta', 'etiqueta', deal.etiqueta)}
      <DealTagsEditor dealId={deal.id} tags={(deal as unknown as { tags?: string[] }).tags ?? []} />
      {deal.data_previsao_fechamento && (
        <div className="py-2 px-2">
          <span className="text-xs text-muted-foreground">Previsão de fechamento</span>
          <p className="text-sm">{new Date(deal.data_previsao_fechamento).toLocaleDateString('pt-BR')}</p>
        </div>
      )}
      </div>
    </div>
  );
}
