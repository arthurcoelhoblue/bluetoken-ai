import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';

const TIPO_LABELS: Record<string, string> = {
  LEAD_QUENTE: '🔥 Lead Quente',
  SLA_ESTOURADO: '⚠️ SLA',
  DEAL_PARADO: '⏳ Deal Parado',
  DEAL_AUTO_CRIADO: '✨ Novo Deal',
  AMELIA_INSIGHT: '🧠 Insight Amélia',
  AMELIA_ALERTA: '🚨 Alerta Amélia',
  AMELIA_CORRECAO: '📝 Correção Amélia',
  AMELIA_SEQUENCIA: '⛓️ Sequência Risco',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function NotificationBell() {
  const { data: notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (notif: { id: string; link: string | null; lida: boolean }) => {
    if (!notif.lida) markAsRead.mutate(notif.id);
    if (notif.link) navigate(notif.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${!n.lida ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {TIPO_LABELS[n.tipo] ?? n.tipo}
                      </p>
                      <p className={`text-sm leading-tight mt-0.5 ${!n.lida ? 'font-medium' : ''}`}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.mensagem}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {!n.lida && (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary absolute top-3 left-1.5" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma notificação
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
