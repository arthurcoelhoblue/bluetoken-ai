import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowRight, Phone, Sparkles, Clock } from 'lucide-react';
import { ACTIVITY_LABELS, ACTIVITY_ICONS } from '@/types/dealDetail';
import type { DealActivity, DealActivityType } from '@/types/dealDetail';
import type { DealActivityMetadata } from '@/types/metadata';
import type { PipelineStage } from '@/types/deal';
import type { DealStageHistoryEntry } from '@/hooks/useDealDetail';

/** Render text with @mentions highlighted */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(@\[([^\]]+)\]\([^)]+\))/g);
  if (parts.length === 1) return <>{text}</>;
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    if (part && part.startsWith('@[')) {
      const name = parts[i + 1]; // captured group
      elements.push(
        <span key={i} className="font-semibold text-primary">@{name}</span>
      );
      i += 3; // skip full match + 2 capture groups
    } else {
      if (part) elements.push(<span key={i}>{part}</span>);
      i++;
    }
  }
  return <>{elements}</>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

interface Props {
  activity: DealActivity;
  stagesMap: Record<string, PipelineStage>;
  stageHistory: DealStageHistoryEntry[];
  onToggleTask: (id: string, concluida: boolean, dealId: string) => void;
  dealId: string;
}

export function TimelineItem({ activity: a, stagesMap, stageHistory, onToggleTask, dealId }: Props) {
  const meta = a.metadata as DealActivityMetadata | null;

  const renderRichContent = () => {
    switch (a.tipo) {
      case 'STAGE_CHANGE': {
        const fromId = meta?.from_stage_id as string | undefined;
        const toId = meta?.to_stage_id as string | undefined;
        const fromStage = fromId ? stagesMap[fromId] : null;
        const toStage = toId ? stagesMap[toId] : null;

        // Find matching stage history for time info
        const historyMatch = stageHistory.find(
          h => h.to_stage_id === toId && h.from_stage_id === fromId
        );

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {fromStage ? (
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: fromStage.cor, color: fromStage.cor }}>
                  {fromStage.nome}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">{fromId ? '...' : 'Início'}</span>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              {toStage ? (
                <Badge className="text-[10px]" style={{ backgroundColor: toStage.cor, color: '#fff' }}>
                  {toStage.nome}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">{toId ?? '?'}</span>
              )}
              {historyMatch?.auto_advanced && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5">⚡ Auto</Badge>
              )}
            </div>
            {historyMatch?.tempo_no_stage_anterior_ms && historyMatch.tempo_no_stage_anterior_ms > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {formatDuration(historyMatch.tempo_no_stage_anterior_ms)} no estágio anterior
              </div>
            )}
          </div>
        );
      }

      case 'VALOR_CHANGE': {
        const oldVal = meta?.old_valor as number | undefined;
        const newVal = meta?.new_valor as number | undefined;
        if (oldVal != null && newVal != null) {
          return (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground line-through">{formatCurrency(oldVal)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-foreground">{formatCurrency(newVal)}</span>
            </div>
          );
        }
        return a.descricao ? <p className="text-sm text-muted-foreground">{a.descricao}</p> : null;
      }

      case 'GANHO':
        return (
          <div className="flex items-center gap-2 mt-0.5">
            <Badge className="bg-green-600 text-white text-[10px]">🏆 Ganho</Badge>
            {a.descricao && <span className="text-sm text-muted-foreground">{a.descricao}</span>}
          </div>
        );

      case 'PERDA': {
        const motivo = meta?.motivo as string | undefined;
        const categoria = meta?.categoria as string | undefined;
        return (
          <div className="space-y-1 mt-0.5">
            <Badge variant="destructive" className="text-[10px]">❌ Perdido</Badge>
            {motivo && <p className="text-xs text-muted-foreground">Motivo: {motivo}</p>}
            {categoria && <Badge variant="outline" className="text-[10px]">{categoria}</Badge>}
          </div>
        );
      }

      case 'CALL': {
        const callMeta = meta as Record<string, unknown> | null;
        const direction = callMeta?.direction as string | undefined;
        const duration = callMeta?.duration as number | undefined;
        const recordingUrl = callMeta?.recording_url as string | undefined;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3 w-3 text-primary" />
              <span>{direction === 'INBOUND' ? '📥 Recebida' : '📤 Realizada'}</span>
              {duration != null && <span className="text-muted-foreground">({Math.floor(duration / 60)}m {duration % 60}s)</span>}
            </div>
            {a.descricao && <p className="text-xs text-muted-foreground">{a.descricao}</p>}
            {recordingUrl && (
              <a href={recordingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">
                🔊 Ouvir gravação
              </a>
            )}
          </div>
        );
      }

      case 'CADENCIA': {
        const cadMeta = meta as Record<string, unknown> | null;
        const cadName = cadMeta?.cadence_name as string | undefined;
        const stepOrder = cadMeta?.step_ordem as number | undefined;
        return (
          <div className="text-sm">
            {cadName && <span className="font-medium">{cadName}</span>}
            {stepOrder != null && <span className="text-muted-foreground"> · Step {stepOrder}</span>}
            {a.descricao && <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>}
          </div>
        );
      }

      case 'WHATSAPP': {
        return (
          <div className="text-sm">
            {a.descricao && <p className="text-muted-foreground">{a.descricao}</p>}
          </div>
        );
      }

      case 'TAREFA':
        return (
          <div className="flex items-center gap-2 mt-1">
            <Checkbox
              checked={a.tarefa_concluida}
              onCheckedChange={checked => onToggleTask(a.id, !!checked, dealId)}
            />
            <span className={`text-sm ${a.tarefa_concluida ? 'line-through text-muted-foreground' : ''}`}>
              {a.descricao}
            </span>
          </div>
        );

      case 'CRIACAO': {
        const criacaoMeta = meta as DealActivityMetadata | null;
        if (!criacaoMeta?.origem) {
          return a.descricao ? <p className="text-sm text-muted-foreground mt-0.5">{a.descricao}</p> : null;
        }

        if (criacaoMeta.origem === 'SDR_IA' && criacaoMeta.dados_extraidos) {
          return (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {criacaoMeta.dados_extraidos.necessidade_principal && (
                <Badge variant="secondary" className="text-[10px]">📋 {criacaoMeta.dados_extraidos.necessidade_principal}</Badge>
              )}
              {criacaoMeta.dados_extraidos.valor_mencionado && (
                <Badge variant="secondary" className="text-[10px]">💰 {formatCurrency(Number(criacaoMeta.dados_extraidos.valor_mencionado))}</Badge>
              )}
              {criacaoMeta.dados_extraidos.urgencia && (
                <Badge variant="outline" className="text-[10px]">⚡ {criacaoMeta.dados_extraidos.urgencia}</Badge>
              )}
              {criacaoMeta.dados_extraidos.decisor_identificado && (
                <Badge variant="outline" className="text-[10px]">✅ Decisor</Badge>
              )}
              {criacaoMeta.dados_extraidos.prazo_mencionado && (
                <Badge variant="outline" className="text-[10px]">📅 {criacaoMeta.dados_extraidos.prazo_mencionado}</Badge>
              )}
              <Badge variant="default" className="text-[10px]">🤖 SDR IA</Badge>
            </div>
          );
        }

        if (criacaoMeta.origem === 'FORMULARIO') {
          const campos = criacaoMeta.campos_preenchidos || {};
          const utmParts = [criacaoMeta.utm_source, criacaoMeta.utm_medium, criacaoMeta.utm_campaign].filter(Boolean);
          const HIDDEN_KEYS = ['form_id', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
          const visibleEntries = Object.entries(campos).filter(([k]) => !HIDDEN_KEYS.includes(k));
          return (
            <div className="mt-1.5 space-y-1">
              {criacaoMeta.canal_origem && (
                <Badge variant="secondary" className="text-[10px]">📎 {criacaoMeta.canal_origem}</Badge>
              )}
              {visibleEntries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {visibleEntries.map(([key, val]) => (
                    <Badge key={key} variant="outline" className="text-[10px]">{key}: {String(val)}</Badge>
                  ))}
                </div>
              )}
              {utmParts.length > 0 && (
                <p className="text-[10px] text-muted-foreground">📎 UTM: {utmParts.join(' / ')}</p>
              )}
              <Badge variant="default" className="text-[10px]">📝 Formulário</Badge>
            </div>
          );
        }

        return a.descricao ? <p className="text-sm text-muted-foreground mt-0.5">{a.descricao}</p> : null;
      }

      default:
        return a.descricao ? <p className="text-sm text-muted-foreground mt-0.5">{a.descricao}</p> : null;
    }
  };

  return (
    <div className="flex gap-3 relative">
      {/* Avatar / Icon */}
      <div className="flex flex-col items-center z-10">
        {a.user_avatar ? (
          <Avatar className="h-7 w-7">
            <AvatarImage src={a.user_avatar} />
            <AvatarFallback className="text-[10px]">{(a.user_nome ?? '?')[0]}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-base shrink-0">
            {ACTIVITY_ICONS[a.tipo]}
          </div>
        )}
        {/* Vertical connector line */}
        <div className="w-px flex-1 bg-border/60 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{ACTIVITY_LABELS[a.tipo]}</span>
          <span className="text-[10px] text-muted-foreground">{formatDate(a.created_at)}</span>
          {a.user_nome && <span className="text-[10px] text-muted-foreground">· {a.user_nome}</span>}
          {(() => {
            const m = a.metadata as Record<string, unknown>;
            if (m?.source === 'call-transcribe-auto') {
              return <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5"><Sparkles className="h-2.5 w-2.5" />Auto IA</Badge>;
            }
            return null;
          })()}
        </div>
        {renderRichContent()}
      </div>
    </div>
  );
}
