import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Video, Calendar, Clock, Upload, MoreVertical, ExternalLink,
  CheckCircle2, XCircle, AlertTriangle, FileText, ChevronDown, ChevronUp,
  Users, Target, MessageSquare, ListTodo, HelpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMeetings, Meeting, TranscriptionMetadata } from '@/hooks/useMeetings';

interface DealMeetingsTabProps {
  dealId: string;
  leadId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  AGENDADA: { label: 'Agendada', variant: 'default', icon: Calendar },
  CONFIRMADA: { label: 'Confirmada', variant: 'default', icon: CheckCircle2 },
  REALIZADA: { label: 'Realizada', variant: 'secondary', icon: CheckCircle2 },
  CANCELADA: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
  NO_SHOW: { label: 'No Show', variant: 'destructive', icon: AlertTriangle },
};

export function DealMeetingsTab({ dealId, leadId }: DealMeetingsTabProps) {
  const { meetings, loading, updateMeetingStatus, uploadTranscription } = useMeetings(dealId, leadId);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const handleFileUpload = async (meetingId: string, file: File) => {
    setUploadingFor(meetingId);
    await uploadTranscription(meetingId, file);
    setUploadingFor(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando reuniões...</div>;
  }

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <Video className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">Nenhuma reunião agendada</p>
        <p className="text-xs mt-1">A Amélia agendará reuniões automaticamente durante a conversa</p>
      </div>
    );
  }

  const upcoming = meetings.filter(m => ['AGENDADA', 'CONFIRMADA'].includes(m.status));
  const past = meetings.filter(m => ['REALIZADA', 'CANCELADA', 'NO_SHOW'].includes(m.status));

  return (
    <div className="space-y-4 p-1">
      {/* Hidden file input for transcription upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.vtt,.srt,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingFor) {
            handleFileUpload(uploadingFor, file);
          }
          e.target.value = '';
        }}
      />

      {/* Upcoming meetings */}
      {upcoming.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Próximas</h4>
          {upcoming.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              expanded={expandedMeeting === meeting.id}
              onToggle={() => setExpandedMeeting(expandedMeeting === meeting.id ? null : meeting.id)}
              onStatusChange={updateMeetingStatus}
              onUploadTranscription={(id) => {
                setUploadingFor(id);
                fileInputRef.current?.click();
              }}
              uploading={uploadingFor === meeting.id}
              showMetadata={showMetadata === meeting.id}
              onToggleMetadata={() => setShowMetadata(showMetadata === meeting.id ? null : meeting.id)}
            />
          ))}
        </div>
      )}

      {/* Past meetings */}
      {past.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Histórico</h4>
          {past.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              expanded={expandedMeeting === meeting.id}
              onToggle={() => setExpandedMeeting(expandedMeeting === meeting.id ? null : meeting.id)}
              onStatusChange={updateMeetingStatus}
              onUploadTranscription={(id) => {
                setUploadingFor(id);
                fileInputRef.current?.click();
              }}
              uploading={uploadingFor === meeting.id}
              showMetadata={showMetadata === meeting.id}
              onToggleMetadata={() => setShowMetadata(showMetadata === meeting.id ? null : meeting.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========================================
// MEETING CARD
// ========================================

interface MeetingCardProps {
  meeting: Meeting;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: Meeting['status']) => void;
  onUploadTranscription: (id: string) => void;
  uploading: boolean;
  showMetadata: boolean;
  onToggleMetadata: () => void;
}

function MeetingCard({
  meeting, expanded, onToggle, onStatusChange, onUploadTranscription, uploading, showMetadata, onToggleMetadata,
}: MeetingCardProps) {
  const config = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.AGENDADA;
  const StatusIcon = config.icon;
  const startDate = new Date(meeting.data_hora_inicio);
  const endDate = new Date(meeting.data_hora_fim);
  const isPast = startDate < new Date();
  const metadata = meeting.transcricao_metadata as TranscriptionMetadata | null;

  return (
    <Card className="mb-2">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col items-center text-center min-w-[45px]">
              <span className="text-xs text-muted-foreground">
                {format(startDate, 'dd MMM', { locale: ptBR })}
              </span>
              <span className="text-lg font-bold leading-tight">
                {format(startDate, 'HH:mm')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {meeting.convidado_nome || 'Reunião'}
                </p>
                <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
                  {config.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                {meeting.google_meet_link && ' · Google Meet'}
                {meeting.agendado_por === 'AMELIA' && ' · Agendado pela Amélia'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {meeting.google_meet_link && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); window.open(meeting.google_meet_link!, '_blank'); }}
                title="Abrir Google Meet"
              >
                <Video className="h-4 w-4 text-blue-500" />
              </Button>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {meeting.google_meet_link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(meeting.google_meet_link!, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Abrir Meet
                </Button>
              )}

              {isPast && !meeting.transcricao_processada && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUploadTranscription(meeting.id)}
                  disabled={uploading}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {uploading ? 'Processando...' : 'Upload Transcrição'}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {meeting.status === 'AGENDADA' && (
                    <DropdownMenuItem onClick={() => onStatusChange(meeting.id, 'CONFIRMADA')}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar
                    </DropdownMenuItem>
                  )}
                  {['AGENDADA', 'CONFIRMADA'].includes(meeting.status) && (
                    <>
                      <DropdownMenuItem onClick={() => onStatusChange(meeting.id, 'REALIZADA')}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como Realizada
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(meeting.id, 'NO_SHOW')}>
                        <AlertTriangle className="h-4 w-4 mr-2" /> No Show
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStatusChange(meeting.id, 'CANCELADA')}>
                        <XCircle className="h-4 w-4 mr-2" /> Cancelar
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Transcription metadata */}
            {metadata && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                  onClick={onToggleMetadata}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Insights da Reunião
                  </span>
                  {showMetadata ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {showMetadata && (
                  <div className="mt-2 space-y-3 text-sm">
                    {/* Summary */}
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="font-medium mb-1">Resumo</p>
                      <p className="text-muted-foreground">{metadata.resumo}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-2">
                      <Badge variant={metadata.interesse_detectado === 'ALTO' ? 'default' : 'secondary'}>
                        <Target className="h-3 w-3 mr-1" />
                        Interesse: {metadata.interesse_detectado}
                      </Badge>
                      <Badge variant={metadata.sentimento_geral === 'POSITIVO' ? 'default' : 'secondary'}>
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {metadata.sentimento_geral}
                      </Badge>
                    </div>

                    {/* Lists */}
                    {metadata.pontos_chave.length > 0 && (
                      <MetadataList icon={Target} title="Pontos-chave" items={metadata.pontos_chave} />
                    )}
                    {metadata.proximos_passos.length > 0 && (
                      <MetadataList icon={ListTodo} title="Próximos passos" items={metadata.proximos_passos} />
                    )}
                    {metadata.objecoes_levantadas.length > 0 && (
                      <MetadataList icon={AlertTriangle} title="Objeções" items={metadata.objecoes_levantadas} />
                    )}
                    {metadata.decisoes_tomadas.length > 0 && (
                      <MetadataList icon={CheckCircle2} title="Decisões" items={metadata.decisoes_tomadas} />
                    )}
                    {metadata.perguntas_pendentes.length > 0 && (
                      <MetadataList icon={HelpCircle} title="Pendências" items={metadata.perguntas_pendentes} />
                    )}
                    {metadata.participantes_detectados.length > 0 && (
                      <MetadataList icon={Users} title="Participantes" items={metadata.participantes_detectados} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetadataList({ icon: Icon, title, items }: { icon: typeof Target; title: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pl-1">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}
