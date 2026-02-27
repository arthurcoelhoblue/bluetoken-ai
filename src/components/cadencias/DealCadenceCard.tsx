import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Play, Pause, Square, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  useDealCadenciaStatus,
  useCadenciasCRM,
  useStartDealCadence,
  usePauseDealCadence,
  useResumeDealCadence,
  useCancelDealCadence,
  validateCadenceTemplatesApproved,
} from '@/hooks/useCadenciasCRM';
import type { DealCadenciaStatus } from '@/types/cadence';

interface Props {
  dealId: string;
  contactId: string;
  empresa: string;
}

function useContactLeadId(contactId: string) {
  return useQuery({
    queryKey: ['contact-lead-id', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('legacy_lead_id')
        .eq('id', contactId)
        .single();
      return data?.legacy_lead_id ?? null;
    },
  });
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE: { label: 'Ativa', variant: 'default' },
  PAUSED: { label: 'Pausada', variant: 'secondary' },
  COMPLETED: { label: 'Concluída', variant: 'outline' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
};

export function DealCadenceCard({ dealId, contactId, empresa }: Props) {
  const { data: leadId } = useContactLeadId(contactId);
  const { data: statuses = [] } = useDealCadenciaStatus(dealId);
  const { data: cadencias = [] } = useCadenciasCRM();
  const startCadence = useStartDealCadence();
  const pauseCadence = usePauseDealCadence();
  const resumeCadence = useResumeDealCadence();
  const cancelCadence = useCancelDealCadence();

  const [selectedCadence, setSelectedCadence] = useState('');
  const [showSelector, setShowSelector] = useState(false);

  const activeCadences = statuses.filter(s => s.bridge_status === 'ACTIVE' || s.bridge_status === 'PAUSED');
  const historyCadences = statuses.filter(s => s.bridge_status === 'COMPLETED' || s.bridge_status === 'CANCELLED');

  // Available cadences = those not already active for this deal
  const activeCadenceIds = new Set(activeCadences.map(s => s.cadence_id));
  const availableCadences = cadencias.filter(c => c.ativo && !activeCadenceIds.has(c.id));

  const [validating, setValidating] = useState(false);

  const handleStart = async () => {
    if (!selectedCadence || !leadId) {
      toast.error(leadId ? 'Selecione uma cadência' : 'Contato sem lead vinculado');
      return;
    }

    // Pre-validate templates
    setValidating(true);
    try {
      const validation = await validateCadenceTemplatesApproved(selectedCadence, empresa);
      if (!validation.valid) {
        toast.error(`Templates não aprovados na Meta: ${validation.unapproved.join(', ')}`);
        setValidating(false);
        return;
      }
    } catch {
      // If validation fails, let the mutation handle it
    }
    setValidating(false);

    startCadence.mutate(
      { dealId, cadenceId: selectedCadence, leadId, empresa },
      {
        onSuccess: () => {
          toast.success('Cadência iniciada');
          setSelectedCadence('');
          setShowSelector(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao iniciar cadência'),
      }
    );
  };

  const renderActions = (s: DealCadenciaStatus) => {
    const args = { dealCadenceRunId: s.deal_cadence_run_id, cadenceRunId: s.cadence_run_id, dealId };
    if (s.bridge_status === 'ACTIVE') {
      return (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => pauseCadence.mutate(args, { onSuccess: () => toast.success('Pausada') })}>
            <Pause className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => cancelCadence.mutate(args, { onSuccess: () => toast.info('Cancelada') })}>
            <Square className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    if (s.bridge_status === 'PAUSED') {
      return (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => resumeCadence.mutate(args, { onSuccess: () => toast.success('Retomada') })}>
            <Play className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => cancelCadence.mutate(args, { onSuccess: () => toast.info('Cancelada') })}>
            <Square className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Cadências</span>
            {activeCadences.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5">{activeCadences.length} ativa{activeCadences.length > 1 ? 's' : ''}</Badge>
            )}
          </div>
          {!showSelector && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowSelector(true)}>
              <Plus className="h-3 w-3" /> Iniciar
            </Button>
          )}
        </div>

        {/* Start selector */}
        {showSelector && (
          <div className="flex items-center gap-2">
            <Select value={selectedCadence} onValueChange={setSelectedCadence}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Selecionar cadência..." />
              </SelectTrigger>
              <SelectContent>
                {availableCadences.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome} ({c.total_steps} steps)</SelectItem>
                ))}
                {availableCadences.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma cadência disponível</div>
                )}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={handleStart} disabled={startCadence.isPending || validating || !selectedCadence}>
              <Play className="h-3 w-3 mr-1" /> Iniciar
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowSelector(false); setSelectedCadence(''); }}>
              ✕
            </Button>
          </div>
        )}

        {/* Active cadences */}
        {activeCadences.map(s => {
          const progress = s.total_steps > 0 ? (s.last_step_ordem / s.total_steps) * 100 : 0;
          const badge = STATUS_BADGE[s.bridge_status] ?? STATUS_BADGE.ACTIVE;
          return (
            <div key={s.deal_cadence_run_id} className="border rounded-md p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{s.cadence_nome}</span>
                  <Badge variant={badge.variant} className="text-[10px] h-4">{badge.label}</Badge>
                </div>
                {renderActions(s)}
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground">{s.last_step_ordem}/{s.total_steps}</span>
              </div>
              {s.next_run_at && s.bridge_status === 'ACTIVE' && (
                <p className="text-[10px] text-muted-foreground">
                  Próximo step: {formatDistanceToNow(new Date(s.next_run_at), { addSuffix: true, locale: ptBR })}
                </p>
              )}
              {s.trigger_type !== 'MANUAL' && s.trigger_stage_nome && (
                <p className="text-[10px] text-muted-foreground">
                  Trigger: {s.trigger_type === 'STAGE_ENTER' ? 'Entrada' : 'Saída'} → {s.trigger_stage_nome}
                </p>
              )}
            </div>
          );
        })}

        {/* History */}
        {historyCadences.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Histórico</span>
            {historyCadences.map(s => {
              const badge = STATUS_BADGE[s.bridge_status] ?? STATUS_BADGE.CANCELLED;
              return (
                <div key={s.deal_cadence_run_id} className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">{s.cadence_nome}</span>
                  <Badge variant={badge.variant} className="text-[10px] h-4">{badge.label}</Badge>
                </div>
              );
            })}
          </div>
        )}

        {statuses.length === 0 && !showSelector && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma cadência vinculada.</p>
        )}
      </CardContent>
    </Card>
  );
}
