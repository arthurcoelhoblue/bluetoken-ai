import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Trophy, XCircle, RotateCcw, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CopilotPanel } from '@/components/copilot/CopilotPanel';
import { ClickToCallButton } from '@/components/zadarma/ClickToCallButton';
import type { DealFullDetail } from '@/types/deal';
import type { PipelineStage } from '@/types/deal';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface DealDetailHeaderProps {
  deal: DealFullDetail;
  stages: PipelineStage[];
  isClosed: boolean;
  onWin: () => void;
  onLose: () => void;
  onReopen: () => void;
  onStageClick: (stageId: string) => void;
  legacyLeadId?: string | null;
  leadEmpresa?: string | null;
  onClose?: () => void;
}

export function DealDetailHeader({ deal, stages, isClosed, onWin, onLose, onReopen, onStageClick, legacyLeadId, leadEmpresa, onClose }: DealDetailHeaderProps) {
  const navigate = useNavigate();
  const orderedStages = stages.filter(s => !s.is_won && !s.is_lost).sort((a, b) => a.posicao - b.posicao);
  const currentStageIndex = orderedStages.findIndex(s => s.id === deal.stage_id);
  const progressPercent = orderedStages.length > 1 ? ((currentStageIndex + 1) / orderedStages.length) * 100 : 0;

  const minutosNoStage = deal.minutos_no_stage ?? 0;
  const horasNoStage = Math.floor(minutosNoStage / 60);
  const diasNoStage = Math.floor(horasNoStage / 24);
  const slaExcedido = deal.sla_minutos ? minutosNoStage > deal.sla_minutos : false;

  return (
    <div className="px-6 pt-6 pb-4 border-b space-y-3">
      <SheetHeader className="p-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-lg truncate">{deal.titulo}</SheetTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{deal.pipeline_empresa}</Badge>
              <Badge variant="outline" className="text-xs">{deal.pipeline_nome}</Badge>
              {deal.stage_cor && (
                <Badge variant="outline" className="text-xs" style={{ borderColor: deal.stage_cor, color: deal.stage_cor }}>
                  {deal.stage_nome}
                </Badge>
              )}
              {isClosed && (
                <Badge variant={deal.status === 'GANHO' ? 'default' : 'destructive'} className="text-xs">
                  {deal.status}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {legacyLeadId && leadEmpresa && (
              <Button
                variant="ghost"
                size="icon"
                title="Ver página completa do lead"
                onClick={() => {
                  navigate(`/leads/${legacyLeadId}/${leadEmpresa}`);
                  onClose?.();
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <ClickToCallButton
              phone={deal.contact_telefone}
              contactName={deal.contact_nome}
              dealId={deal.id}
            />
            <CopilotPanel
              context={{ type: 'DEAL', id: deal.id, empresa: deal.pipeline_empresa ?? '' }}
              variant="icon"
            />
          </div>
        </div>
      </SheetHeader>

      {/* Value + time in stage */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{formatBRL(deal.valor ?? 0)}</span>
        <span className={`flex items-center gap-1 text-xs ${slaExcedido ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {slaExcedido && <AlertTriangle className="h-3 w-3" />}
          <Clock className="h-3 w-3" />
          {diasNoStage}d {horasNoStage % 24}h no estágio
        </span>
      </div>

      {/* Progress bar */}
      {orderedStages.length > 0 && (
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between">
            {orderedStages.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onStageClick(s.id)}
                disabled={isClosed}
                className={`text-[10px] px-1 py-0.5 rounded transition-colors ${
                  s.id === deal.stage_id
                    ? 'font-bold text-primary'
                    : i <= currentStageIndex
                      ? 'text-foreground hover:text-primary cursor-pointer'
                      : 'text-muted-foreground hover:text-foreground cursor-pointer'
                } ${isClosed ? 'cursor-default' : ''}`}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {isClosed ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onReopen}>
            <RotateCcw className="h-3.5 w-3.5" /> Reabrir
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="gap-1.5 text-success hover:text-success" onClick={onWin}>
              <Trophy className="h-3.5 w-3.5" /> Ganhar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={onLose}>
              <XCircle className="h-3.5 w-3.5" /> Perder
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
