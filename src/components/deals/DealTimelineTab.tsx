import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Phone, Mail, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { DealCadenceCard } from '@/components/cadencias/DealCadenceCard';
import { DealCallsPanel } from '@/components/zadarma/DealCallsPanel';
import { FollowUpHintCard } from '@/components/deals/FollowUpHintCard';
import { ACTIVITY_LABELS, ACTIVITY_ICONS } from '@/types/dealDetail';
import type { DealActivityType, DealActivity, DealFullDetail } from '@/types/dealDetail';
import type { DealActivityMetadata } from '@/types/metadata';
import type { UseMutationResult } from '@tanstack/react-query';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface DealTimelineTabProps {
  deal: DealFullDetail;
  dealId: string;
  activities: DealActivity[] | undefined;
  addActivity: UseMutationResult<unknown, Error, { deal_id: string; tipo: DealActivityType; descricao: string }>;
  toggleTask: UseMutationResult<unknown, Error, { id: string; concluida: boolean; dealId: string }>;
  onOpenEmail: () => void;
}

export function DealTimelineTab({ deal, dealId, activities, addActivity, toggleTask, onOpenEmail }: DealTimelineTabProps) {
  const [activityType, setActivityType] = useState<DealActivityType>('NOTA');
  const [activityText, setActivityText] = useState('');

  const handleAddActivity = () => {
    if (!dealId || !activityText.trim()) return;
    addActivity.mutate({ deal_id: dealId, tipo: activityType, descricao: activityText.trim() }, {
      onSuccess: () => { setActivityText(''); toast.success('Atividade adicionada'); },
    });
  };

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

      {/* Activity feed */}
      <div className="space-y-2 pb-4">
        {activities?.map(a => (
          <div key={a.id} className="flex gap-3 py-2 border-b border-border/40 last:border-0">
            <span className="text-base mt-0.5">{ACTIVITY_ICONS[a.tipo]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {a.tipo === 'LIGACAO' && <Phone className="h-3 w-3 text-primary" />}
                <span className="text-xs font-medium">{ACTIVITY_LABELS[a.tipo]}</span>
                <span className="text-[10px] text-muted-foreground">{formatDate(a.created_at)}</span>
                {a.user_nome && <span className="text-[10px] text-muted-foreground">· {a.user_nome}</span>}
                {(() => {
                  const meta = a.metadata as Record<string, unknown>;
                  if (meta?.source === 'call-transcribe-auto') {
                    return <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5"><Sparkles className="h-2.5 w-2.5" />Auto IA</Badge>;
                  }
                  return null;
                })()}
              </div>
              {a.tipo === 'TAREFA' ? (
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    checked={a.tarefa_concluida}
                    onCheckedChange={checked => dealId && toggleTask.mutate({ id: a.id, concluida: !!checked, dealId })}
                  />
                  <span className={`text-sm ${a.tarefa_concluida ? 'line-through text-muted-foreground' : ''}`}>
                    {a.descricao}
                  </span>
                </div>
              ) : (
                <>
                  {a.descricao && <p className="text-sm text-muted-foreground mt-0.5">{a.descricao}</p>}
                  {a.tipo === 'CRIACAO' && (() => {
                    const meta = a.metadata as unknown as DealActivityMetadata | null;
                    if (!meta?.origem || meta.origem !== 'SDR_IA' || !meta.dados_extraidos) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {meta.dados_extraidos.necessidade_principal && (
                          <Badge variant="secondary" className="text-[10px]">📋 {meta.dados_extraidos.necessidade_principal}</Badge>
                        )}
                        {meta.dados_extraidos.valor_mencionado && (
                          <Badge variant="secondary" className="text-[10px]">💰 R$ {Number(meta.dados_extraidos.valor_mencionado).toLocaleString('pt-BR')}</Badge>
                        )}
                        {meta.dados_extraidos.urgencia && (
                          <Badge variant="outline" className="text-[10px]">⚡ {meta.dados_extraidos.urgencia}</Badge>
                        )}
                        {meta.dados_extraidos.decisor_identificado && (
                          <Badge variant="outline" className="text-[10px]">✅ Decisor</Badge>
                        )}
                        {meta.dados_extraidos.prazo_mencionado && (
                          <Badge variant="outline" className="text-[10px]">📅 {meta.dados_extraidos.prazo_mencionado}</Badge>
                        )}
                        <Badge variant="default" className="text-[10px]">🤖 SDR IA</Badge>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        ))}
        {(!activities || activities.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
        )}
      </div>
    </div>
  );
}
