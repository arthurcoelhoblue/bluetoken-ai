import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Atendimento } from '@/hooks/useAtendimentos';

const ESTADO_LABELS: Record<string, string> = {
  SAUDACAO: 'Saudação',
  DIAGNOSTICO: 'Diagnóstico',
  QUALIFICACAO: 'Qualificação',
  OBJECOES: 'Objeções',
  FECHAMENTO: 'Fechamento',
  POS_VENDA: 'Pós-venda',
};

const INTENT_LABELS: Record<string, string> = {
  INTERESSE_COMPRA: 'Interesse',
  DUVIDA_PRODUTO: 'Dúvida produto',
  DUVIDA_PRECO: 'Dúvida preço',
  SOLICITACAO_CONTATO: 'Quer contato',
  AGENDAMENTO_REUNIAO: 'Agendar reunião',
  RECLAMACAO: 'Reclamação',
  OPT_OUT: 'Opt-out',
  CUMPRIMENTO: 'Cumprimento',
  AGRADECIMENTO: 'Agradecimento',
  INTERESSE_IR: 'Interesse IR',
  OBJECAO_PRECO: 'Objeção preço',
  OBJECAO_RISCO: 'Objeção risco',
  SEM_INTERESSE: 'Sem interesse',
  DUVIDA_TECNICA: 'Dúvida técnica',
  FORA_CONTEXTO: 'Fora de contexto',
  NAO_ENTENDI: 'Não entendeu',
  OUTRO: 'Outro',
};

function getStatusInfo(atendimento: Atendimento) {
  if (!atendimento.ultimo_contato) {
    return { label: 'Sem mensagens', variant: 'outline' as const, className: '' };
  }
  if (atendimento.ultima_direcao === 'INBOUND' && atendimento.total_outbound === 0) {
    return { label: 'Aguardando resposta', variant: 'destructive' as const, className: '' };
  }
  if (atendimento.ultima_direcao === 'INBOUND') {
    return { label: 'Aguardando resposta', variant: 'secondary' as const, className: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  return { label: 'Amélia respondeu', variant: 'default' as const, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
}

interface AtendimentoCardProps {
  atendimento: Atendimento;
}

export function AtendimentoCard({ atendimento }: AtendimentoCardProps) {
  const navigate = useNavigate();
  const status = getStatusInfo(atendimento);

  const tempoDesdeContato = atendimento.ultimo_contato
    ? formatDistanceToNow(new Date(atendimento.ultimo_contato), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/leads/${atendimento.lead_id}/${atendimento.empresa}`)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Name + empresa */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">
                {atendimento.nome || atendimento.telefone || atendimento.lead_id}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {atendimento.empresa}
              </Badge>
              <Badge variant={status.variant} className={`text-[10px] px-1.5 py-0 ${status.className}`}>
                {status.label}
              </Badge>
            </div>

            {/* Phone */}
            {atendimento.telefone && (
              <p className="text-xs text-muted-foreground">{atendimento.telefone_e164 || atendimento.telefone}</p>
            )}

            {/* Last message preview */}
            {atendimento.ultima_mensagem && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {atendimento.ultima_direcao === 'INBOUND' ? '👤 ' : '🤖 '}
                {atendimento.ultima_mensagem}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
              {tempoDesdeContato && (
                <span>{tempoDesdeContato}</span>
              )}
              <span className="flex items-center gap-0.5">
                <ArrowDownLeft className="h-3 w-3" /> {atendimento.total_inbound}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" /> {atendimento.total_outbound}
              </span>
              {atendimento.estado_funil && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {ESTADO_LABELS[atendimento.estado_funil] || atendimento.estado_funil}
                </Badge>
              )}
              {atendimento.ultimo_intent && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {INTENT_LABELS[atendimento.ultimo_intent] || atendimento.ultimo_intent}
                </Badge>
              )}
            </div>
          </div>

          {/* Right: action */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/leads/${atendimento.lead_id}/${atendimento.empresa}`);
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
