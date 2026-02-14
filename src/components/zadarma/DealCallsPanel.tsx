import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, ChevronDown, ChevronUp, FileText, Brain, ListChecks } from 'lucide-react';

import { useDealCalls } from '@/hooks/useZadarma';
import type { Call } from '@/types/telephony';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ANSWERED: { label: 'Atendida', variant: 'default' },
  MISSED: { label: 'Perdida', variant: 'destructive' },
  BUSY: { label: 'Ocupado', variant: 'secondary' },
  FAILED: { label: 'Falha', variant: 'destructive' },
  RINGING: { label: 'Tocando', variant: 'outline' },
};

function CallItem({ call }: { call: Call }) {
  const [expanded, setExpanded] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const Icon = call.direcao === 'OUTBOUND' ? PhoneOutgoing : call.status === 'MISSED' ? PhoneMissed : PhoneIncoming;
  const cfg = statusConfig[call.status] || statusConfig.RINGING;

  const callAny = call as any;
  const hasSummary = !!callAny.summary_ia;
  const hasTranscription = !!callAny.transcription;
  const actionItems = callAny.action_items as string[] | null;

  return (
    <>
      <div className="border-b border-border/40 last:border-0 py-2">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <Icon className={`h-4 w-4 shrink-0 ${call.status === 'MISSED' ? 'text-destructive' : call.direcao === 'OUTBOUND' ? 'text-primary' : 'text-success'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {call.contact_nome || (call.direcao === 'OUTBOUND' ? call.destination_number : call.caller_number) || 'Desconhecido'}
              </span>
              <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">{cfg.label}</Badge>
              {callAny.sentiment && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${callAny.sentiment === 'POSITIVO' ? 'text-success border-success/30' : callAny.sentiment === 'NEGATIVO' ? 'text-destructive border-destructive/30' : 'text-muted-foreground'}`}>
                  {callAny.sentiment}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{call.direcao === 'OUTBOUND' ? 'Saída' : 'Entrada'}</span>
              <span>·</span>
              <span>{formatDuration(call.duracao_segundos)}</span>
              <span>·</span>
              <span>{call.created_at ? formatDate(call.created_at) : '—'}</span>
              {call.user_nome && <><span>·</span><span>{call.user_nome}</span></>}
            </div>
          </div>
          {(call.recording_url || hasSummary) && <Play className="h-3.5 w-3.5 text-muted-foreground" />}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        {expanded && (
          <div className="mt-2 ml-7 space-y-2">
            {/* Audio player */}
            {call.recording_url && (
              <audio controls className="w-full h-8" src={call.recording_url}>
                Seu navegador não suporta o player de áudio.
              </audio>
            )}

            {/* AI Summary */}
            {hasSummary && (
              <div className="p-2 bg-muted/50 rounded-md space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Brain className="h-3 w-3" /> Resumo IA
                </div>
                <p className="text-sm">{callAny.summary_ia}</p>
              </div>
            )}

            {/* Action Items */}
            {actionItems && actionItems.length > 0 && (
              <div className="p-2 bg-muted/50 rounded-md space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ListChecks className="h-3 w-3" /> Ações Identificadas
                </div>
                <ul className="text-sm space-y-0.5">
                  {actionItems.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-muted-foreground">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transcription button */}
            {hasTranscription && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTranscriptOpen(true)}>
                <FileText className="h-3 w-3" /> Ver transcrição
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Transcription Dialog */}
      {hasTranscription && (
        <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transcrição da Chamada</DialogTitle>
            </DialogHeader>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
              {callAny.transcription}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

interface Props {
  dealId: string;
}

export function DealCallsPanel({ dealId }: Props) {
  const { data: calls, isLoading } = useDealCalls(dealId);

  if (isLoading) return null;
  if (!calls || calls.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Chamadas ({calls.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {calls.map(call => (
          <CallItem key={call.id} call={call} />
        ))}
      </CardContent>
    </Card>
  );
}
