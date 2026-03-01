import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  UserCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Flame,
  Snowflake,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Atendimento } from '@/hooks/useAtendimentos';

interface ConversaCardProps {
  atendimento: Atendimento;
  compact?: boolean;
}

function TemperaturaBadge({ temperatura }: { temperatura: string | null }) {
  if (!temperatura) return null;
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    QUENTE: { label: 'Quente', className: 'bg-destructive/10 text-destructive border-destructive/20', icon: <Flame className="h-3 w-3" /> },
    MORNO: { label: 'Morno', className: 'bg-warning/10 text-warning border-warning/20', icon: <Flame className="h-3 w-3" /> },
    FRIO: { label: 'Frio', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: <Snowflake className="h-3 w-3" /> },
  };
  const c = config[temperatura];
  if (!c) return null;
  return (
    <Badge variant="outline" className={`text-[10px] py-0 gap-0.5 ${c.className}`}>
      {c.icon}{c.label}
    </Badge>
  );
}

export function ConversaCard({ atendimento: a, compact = false }: ConversaCardProps) {
  const navigate = useNavigate();
  const isModoManual = a.modo === 'MANUAL';
  const tempoSemResposta = a.ultimo_contato
    ? formatDistanceToNow(new Date(a.ultimo_contato), { locale: ptBR, addSuffix: true })
    : null;

  return (
    <Card
      className="cursor-pointer hover:bg-accent/30 transition-colors"
      onClick={() => navigate(`/leads/${a.lead_id}/${a.empresa}`)}
    >
      <CardContent className={`flex items-center gap-4 ${compact ? 'py-2 px-3' : 'py-3 px-4'}`}>
        {/* Avatar with mode indicator */}
        <div className="relative shrink-0">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
            isModoManual ? 'bg-primary/10' : 'bg-accent/50'
          }`}>
            {isModoManual ? (
              <UserCheck className="h-5 w-5 text-primary" />
            ) : (
              <Bot className="h-5 w-5 text-accent-foreground" />
            )}
          </div>
          {a.ultima_direcao === 'INBOUND' && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-warning border-2 border-background" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {a.nome || 'Lead sem nome'}
            </span>
            <Badge variant={a.empresa === 'TOKENIZA' ? 'default' : 'secondary'} className="text-[10px] py-0">
              {a.empresa}
            </Badge>
            {a.deal_stage_nome && (
              <Badge
                variant="outline"
                className="text-[10px] py-0"
                style={{ borderColor: a.deal_stage_cor || undefined, color: a.deal_stage_cor || undefined }}
              >
                {a.deal_stage_nome}
              </Badge>
            )}
            {!compact && <TemperaturaBadge temperatura={a.temperatura} />}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {a.ultima_mensagem || 'Sem mensagens'}
          </p>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {tempoSemResposta && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {tempoSemResposta}
            </span>
          )}
          {!compact && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <ArrowDownLeft className="h-3 w-3" />{a.total_inbound}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />{a.total_outbound}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
