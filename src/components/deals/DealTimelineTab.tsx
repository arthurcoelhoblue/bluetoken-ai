import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { DealCadenceCard } from '@/components/cadencias/DealCadenceCard';
import { DealCallsPanel } from '@/components/zadarma/DealCallsPanel';
import { FollowUpHintCard } from '@/components/deals/FollowUpHintCard';
import { TimelineItem } from '@/components/deals/TimelineItem';
import { MentionTextarea, extractMentionIds } from '@/components/deals/MentionTextarea';
import { ACTIVITY_LABELS } from '@/types/dealDetail';
import type { DealActivityType, DealActivity, DealFullDetail } from '@/types/dealDetail';
import type { PipelineStage } from '@/types/deal';
import type { DealStageHistoryEntry } from '@/hooks/useDealDetail';
import type { UseMutationResult } from '@tanstack/react-query';

type FilterCategory = 'TODOS' | 'NOTAS' | 'COMUNICACAO' | 'MOVIMENTACAO' | 'SISTEMA';

const FILTER_MAP: Record<FilterCategory, DealActivityType[] | null> = {
  TODOS: null,
  NOTAS: ['NOTA'],
  COMUNICACAO: ['LIGACAO', 'EMAIL', 'WHATSAPP', 'CALL', 'REUNIAO'],
  MOVIMENTACAO: ['STAGE_CHANGE', 'GANHO', 'PERDA', 'REABERTO'],
  SISTEMA: ['CADENCIA', 'CRIACAO', 'VALOR_CHANGE', 'OUTRO', 'ARQUIVO'],
};

const FILTER_LABELS: Record<FilterCategory, string> = {
  TODOS: 'Todos',
  NOTAS: 'Notas',
  COMUNICACAO: 'Comunicação',
  MOVIMENTACAO: 'Movimentação',
  SISTEMA: 'Sistema',
};

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Hoje';
  if (itemDate.getTime() === yesterday.getTime()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface DealTimelineTabProps {
  deal: DealFullDetail;
  dealId: string;
  activities: DealActivity[] | undefined;
  stages?: PipelineStage[];
  stageHistory?: DealStageHistoryEntry[];
  addActivity: UseMutationResult<unknown, Error, { deal_id: string; tipo: DealActivityType; descricao: string }>;
  toggleTask: UseMutationResult<unknown, Error, { id: string; concluida: boolean; dealId: string }>;
  onOpenEmail: () => void;
}

export function DealTimelineTab({ deal, dealId, activities, stages, stageHistory, addActivity, toggleTask, onOpenEmail }: DealTimelineTabProps) {
  const [activityType, setActivityType] = useState<DealActivityType>('NOTA');
  const [activityText, setActivityText] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('TODOS');

  const stagesMap = useMemo(() => {
    const map: Record<string, PipelineStage> = {};
    stages?.forEach(s => { map[s.id] = s; });
    return map;
  }, [stages]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    const allowed = FILTER_MAP[filter];
    if (!allowed) return activities;
    return activities.filter(a => allowed.includes(a.tipo));
  }, [activities, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { label: string; items: DealActivity[] }[] = [];
    let currentLabel = '';
    for (const a of filteredActivities) {
      const label = getDateGroup(a.created_at);
      if (label !== currentLabel) {
        groups.push({ label, items: [a] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].items.push(a);
      }
    }
    return groups;
  }, [filteredActivities]);

  const handleAddActivity = () => {
    if (!dealId || !activityText.trim()) return;
    addActivity.mutate({ deal_id: dealId, tipo: activityType, descricao: activityText.trim() }, {
      onSuccess: () => { setActivityText(''); toast.success('Atividade adicionada'); },
    });
  };

  // Fallback: legacy form data
  const legacyFormCard = useMemo(() => {
    const hasCriacaoActivity = activities?.some(a => a.tipo === 'CRIACAO' && (a.metadata as Record<string, unknown>)?.origem === 'FORMULARIO');
    const dealMeta = (deal as DealFullDetail & { metadata?: Record<string, unknown> }).metadata;
    const camposExtras = dealMeta?.campos_extras as Record<string, unknown> | undefined;
    if (!hasCriacaoActivity && camposExtras && Object.keys(camposExtras).length > 0) {
      const HIDDEN = ['form_id', 'source'];
      const entries = Object.entries(camposExtras).filter(([k]) => !HIDDEN.includes(k));
      return (
        <Card>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base">✨</span>
              <span className="text-xs font-medium">Dados do formulário</span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0">Legado</Badge>
            </div>
            {entries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entries.map(([key, val]) => (
                  <Badge key={key} variant="outline" className="text-[10px]">{key}: {String(val)}</Badge>
                ))}
              </div>
            )}
            {dealMeta?.utm_source && (
              <p className="text-[10px] text-muted-foreground">
                📎 UTM: {[dealMeta.utm_source, dealMeta.utm_medium, dealMeta.utm_campaign].filter(Boolean).join(' / ')}
              </p>
            )}
          </CardContent>
        </Card>
      );
    }
    return null;
  }, [activities, deal]);

  return (
    <div className="flex-1 px-6 mt-3 space-y-4 overflow-y-auto">
      <DealCadenceCard dealId={deal.id} contactId={deal.contact_id} empresa={deal.pipeline_empresa ?? ''} />
      <DealCallsPanel dealId={deal.id} />
      <FollowUpHintCard empresa={deal.pipeline_empresa} />

      {/* Add activity inline */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Select value={activityType} onValueChange={v => setActivityType(v as DealActivityType)}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['NOTA', 'LIGACAO', 'EMAIL', 'REUNIAO', 'TAREFA'] as DealActivityType[]).map(t => (
                  <SelectItem key={t} value={t}>{ACTIVITY_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddActivity} disabled={!activityText.trim() || addActivity.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenEmail} title="Enviar email">
              <Mail className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Textarea
            value={activityText}
            onChange={e => setActivityText(e.target.value)}
            placeholder="Descreva a atividade..."
            className="min-h-[60px] text-sm"
            rows={2}
          />
        </CardContent>
      </Card>

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(FILTER_LABELS) as FilterCategory[]).map(key => (
          <Badge
            key={key}
            variant={filter === key ? 'default' : 'outline'}
            className="cursor-pointer text-[11px] px-2 py-0.5"
            onClick={() => setFilter(key)}
          >
            {FILTER_LABELS[key]}
          </Badge>
        ))}
      </div>

      {legacyFormCard}

      {/* Activity feed with date groups */}
      <div className="pb-4">
        {grouped.map(group => (
          <div key={group.label}>
            <div className="flex items-center gap-2 py-2">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{group.label}</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            {group.items.map(a => (
              <TimelineItem
                key={a.id}
                activity={a}
                stagesMap={stagesMap}
                stageHistory={stageHistory ?? []}
                onToggleTask={(id, concluida, dId) => toggleTask.mutate({ id, concluida, dealId: dId })}
                dealId={dealId}
              />
            ))}
          </div>
        ))}
        {filteredActivities.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
        )}
      </div>
    </div>
  );
}
