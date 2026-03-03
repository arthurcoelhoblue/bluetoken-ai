import { useMeetings, type Meeting } from '@/hooks/useMeetings';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Video, Calendar, ExternalLink, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  dealId: string;
}

const STATUS_COLORS: Record<string, string> = {
  AGENDADA: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CONFIRMADA: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REALIZADA: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  CANCELADA: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function DealMeetingsTab({ dealId }: Props) {
  const { data: meetings = [], isLoading } = useMeetings(dealId);

  if (isLoading) {
    return (
      <div className="px-6 mt-3 space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="px-6 mt-3 text-center py-8 text-muted-foreground">
        <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma reunião agendada para este deal.</p>
      </div>
    );
  }

  return (
    <div className="px-6 mt-3 space-y-3 pb-4">
      {meetings.map((m: Meeting) => (
        <Card key={m.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{m.titulo}</span>
              </div>
              <Badge className={STATUS_COLORS[m.status] || ''} variant="secondary">
                {m.status}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mb-2">
              {format(new Date(m.data_inicio), "EEEE, dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              {' — '}
              {format(new Date(m.data_fim), 'HH:mm')}
            </p>

            {m.descricao && (
              <p className="text-xs text-muted-foreground mb-2">{m.descricao}</p>
            )}

            <div className="flex gap-2 mt-2">
              {m.google_meet_link && (
                <a
                  href={m.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Video className="h-3 w-3" />
                  Google Meet
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {m.transcricao_processada && m.transcricao_metadata && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  Transcrição disponível
                </span>
              )}
            </div>

            {m.transcricao_processada && m.transcricao_metadata && (
              <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                <p className="font-medium mb-1">Resumo:</p>
                <p className="text-muted-foreground">
                  {(m.transcricao_metadata as Record<string, unknown>).resumo as string || 'Sem resumo'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
