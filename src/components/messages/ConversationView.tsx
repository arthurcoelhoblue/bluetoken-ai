import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Bot,
  User,
  Brain,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LeadMessageWithContext, MensagemEstado, MensagemDirecao } from '@/types/messaging';
import type { CanalTipo } from '@/types/cadence';
import { EmailPreviewDialog } from './EmailPreviewDialog';

interface ConversationViewProps {
  messages: LeadMessageWithContext[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  leadNome?: string | null;
  maxHeight?: string;
  emptyMessage?: string;
}

function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('<') && (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<body') ||
    trimmed.startsWith('<div') ||
    trimmed.startsWith('<table') ||
    trimmed.startsWith('<p')
  );
}

function getCanalIcon(canal: CanalTipo) {
  switch (canal) {
    case 'WHATSAPP':
      return <MessageSquare className="h-3 w-3" />;
    case 'EMAIL':
      return <Mail className="h-3 w-3" />;
    default:
      return <MessageSquare className="h-3 w-3" />;
  }
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
  leadNome,
}: {
  message: LeadMessageWithContext;
  leadNome?: string | null;
}) {
  const isOutbound = message.direcao === 'OUTBOUND';
  const isUnmatched = message.unmatched === true;

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className="flex items-end gap-2 max-w-[85%]">
        {/* Avatar do remetente */}
        {!isOutbound && (
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-secondary-foreground" />
          </div>
        )}
        
        <div
          className={`${
            isOutbound
              ? 'bg-primary text-primary-foreground rounded-l-xl rounded-tr-xl'
              : 'bg-muted text-foreground rounded-r-xl rounded-tl-xl'
          } p-3 shadow-sm`}
        >
          {/* Header com indicador de quem enviou */}
          <div className="flex items-center gap-2 mb-1">
            {isOutbound ? (
              <span className="flex items-center gap-1 text-xs font-medium opacity-90">
                <Bot className="h-3 w-3" />
                Amélia
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium opacity-90">
                <User className="h-3 w-3" />
                {leadNome || 'Lead'}
              </span>
            )}
            <span className="text-xs opacity-60 flex items-center gap-0.5">
              {getCanalIcon(message.canal)}
              {message.canal}
            </span>
            {isUnmatched && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 bg-warning/10 text-warning-foreground border-warning/30">
                Não associado
              </Badge>
            )}
          </div>

          {/* Content */}
          {message.canal === 'EMAIL' && isHtmlContent(message.conteudo) ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground italic">
                Conteúdo HTML - clique para visualizar
              </p>
              <EmailPreviewDialog 
                htmlContent={message.conteudo}
                subject={message.template_codigo || undefined}
              />
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.conteudo}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 gap-2">
            <Badge
              variant="secondary"
              className={`text-[10px] py-0 px-1.5 ${getEstadoColor(message.estado)}`}
            >
              {getEstadoIcon(message.estado)}
              <span className="ml-0.5">{message.estado}</span>
            </Badge>
            <span className="text-[10px] opacity-60">
              {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
            </span>
          </div>

          {/* Template info */}
          {isOutbound && message.template_codigo && (
            <div className="mt-1 text-[10px] opacity-50">
              Template: {message.template_codigo}
            </div>
          )}

          {/* Error detail */}
          {message.estado === 'ERRO' && message.erro_detalhe && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
              {message.erro_detalhe}
            </div>
          )}

          {/* Delivery timestamps */}
          {(message.enviado_em || message.entregue_em || message.lido_em) && (
            <div className="mt-2 text-[10px] opacity-40 space-y-0.5">
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
        
        {/* Avatar da Amélia */}
        {isOutbound && (
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesByDate({
  messages,
  leadNome,
}: {
  messages: LeadMessageWithContext[];
  leadNome?: string | null;
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
            <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground font-medium">
              {format(new Date(dateKey), "dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>

          {/* Messages for this date */}
          {groupedMessages[dateKey].map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              leadNome={leadNome}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ConversationView({
  messages,
  isLoading,
  error,
  onRetry,
  leadNome,
  maxHeight = '500px',
  emptyMessage = 'Nenhuma mensagem registrada.',
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll para última mensagem quando mensagens mudam
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Contagem de mensagens por direção
  const outboundCount = messages.filter(m => m.direcao === 'OUTBOUND').length;
  const inboundCount = messages.filter(m => m.direcao === 'INBOUND').length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Conversa com {leadNome || 'Lead'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground flex items-center gap-2">
              <Bot className="h-5 w-5 animate-bounce" />
              Carregando conversa...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Conversa com {leadNome || 'Lead'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Erro ao carregar mensagens.</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Tentar novamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Conversa Amélia ↔ {leadNome || 'Lead'}
          </CardTitle>
          {messages.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <ArrowUpRight className="h-3 w-3" />
                {outboundCount}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <ArrowDownLeft className="h-3 w-3" />
                {inboundCount}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {messages.length === 0 ? (
          <div className="text-muted-foreground text-center py-12 space-y-2">
            <Bot className="h-12 w-12 mx-auto opacity-30" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div 
            ref={scrollRef}
            style={{ maxHeight }} 
            className="overflow-y-auto pr-4"
          >
            <MessagesByDate messages={messages} leadNome={leadNome} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
