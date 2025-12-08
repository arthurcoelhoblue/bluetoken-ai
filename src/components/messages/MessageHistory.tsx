import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Mail,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LeadMessageWithContext, MensagemEstado, MensagemDirecao } from '@/types/messaging';
import type { CanalTipo } from '@/types/cadence';

interface MessageHistoryProps {
  messages: LeadMessageWithContext[];
  isLoading?: boolean;
  showCadenceName?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
}

function getCanalIcon(canal: CanalTipo) {
  switch (canal) {
    case 'WHATSAPP':
      return <MessageSquare className="h-4 w-4" />;
    case 'EMAIL':
      return <Mail className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

function getDirecaoIcon(direcao: MensagemDirecao) {
  return direcao === 'OUTBOUND' ? (
    <ArrowUpRight className="h-3 w-3" />
  ) : (
    <ArrowDownLeft className="h-3 w-3" />
  );
}

function getEstadoIcon(estado: MensagemEstado) {
  switch (estado) {
    case 'PENDENTE':
      return <Clock className="h-3 w-3" />;
    case 'ENVIADO':
      return <Check className="h-3 w-3" />;
    case 'ENTREGUE':
      return <CheckCheck className="h-3 w-3" />;
    case 'LIDO':
      return <Eye className="h-3 w-3" />;
    case 'ERRO':
      return <AlertCircle className="h-3 w-3" />;
    case 'RECEBIDO':
      return <ArrowDownLeft className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
}

function getEstadoColor(estado: MensagemEstado): string {
  switch (estado) {
    case 'PENDENTE':
      return 'bg-muted text-muted-foreground';
    case 'ENVIADO':
      return 'bg-primary/20 text-primary';
    case 'ENTREGUE':
      return 'bg-primary/30 text-primary';
    case 'LIDO':
      return 'bg-accent/30 text-accent-foreground';
    case 'ERRO':
      return 'bg-destructive/20 text-destructive';
    case 'RECEBIDO':
      return 'bg-secondary text-secondary-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function MessageBubble({
  message,
  showCadenceName,
}: {
  message: LeadMessageWithContext;
  showCadenceName?: boolean;
}) {
  const isOutbound = message.direcao === 'OUTBOUND';

  return (
    <div
      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`max-w-[80%] ${
          isOutbound
            ? 'bg-primary text-primary-foreground rounded-l-lg rounded-tr-lg'
            : 'bg-muted text-foreground rounded-r-lg rounded-tl-lg'
        } p-3 shadow-sm`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center gap-1 text-xs opacity-80">
            {getCanalIcon(message.canal)}
            {message.canal}
          </span>
          {message.step_ordem && (
            <span className="text-xs opacity-60">Step {message.step_ordem}</span>
          )}
          {showCadenceName && message.cadencia_nome && (
            <span className="text-xs opacity-60 truncate max-w-[100px]">
              {message.cadencia_nome}
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap break-words">{message.conteudo}</p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <Badge
            variant="secondary"
            className={`text-xs py-0 px-1.5 ${getEstadoColor(message.estado)}`}
          >
            {getEstadoIcon(message.estado)}
            <span className="ml-1">{message.estado}</span>
          </Badge>
          <span className="text-xs opacity-60">
            {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
          </span>
        </div>

        {/* Error detail */}
        {message.estado === 'ERRO' && message.erro_detalhe && (
          <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
            {message.erro_detalhe}
          </div>
        )}

        {/* Delivery timestamps */}
        {(message.enviado_em || message.entregue_em || message.lido_em) && (
          <div className="mt-2 text-xs opacity-50 space-y-0.5">
            {message.enviado_em && (
              <p>Enviado: {format(new Date(message.enviado_em), 'HH:mm:ss', { locale: ptBR })}</p>
            )}
            {message.entregue_em && (
              <p>Entregue: {format(new Date(message.entregue_em), 'HH:mm:ss', { locale: ptBR })}</p>
            )}
            {message.lido_em && (
              <p>Lido: {format(new Date(message.lido_em), 'HH:mm:ss', { locale: ptBR })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesByDate({
  messages,
  showCadenceName,
}: {
  messages: LeadMessageWithContext[];
  showCadenceName?: boolean;
}) {
  // Group messages by date
  const groupedMessages = messages.reduce(
    (acc, msg) => {
      const dateKey = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(msg);
      return acc;
    },
    {} as Record<string, LeadMessageWithContext[]>
  );

  const sortedDates = Object.keys(groupedMessages).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div>
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          {/* Date separator */}
          <div className="flex justify-center my-4">
            <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
              {format(new Date(dateKey), "dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>

          {/* Messages for this date */}
          {groupedMessages[dateKey].map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              showCadenceName={showCadenceName}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MessageHistory({
  messages,
  isLoading,
  showCadenceName = false,
  maxHeight = '400px',
  emptyMessage = 'Nenhuma mensagem registrada.',
}: MessageHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Histórico de Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">
              Carregando mensagens...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Histórico de Mensagens
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {messages.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : (
          <ScrollArea style={{ maxHeight }} className="pr-4">
            <MessagesByDate messages={messages} showCadenceName={showCadenceName} />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
