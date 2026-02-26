import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAtendimentos, type Atendimento } from '@/hooks/useAtendimentos';
import { useCompany } from '@/contexts/CompanyContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessagesSquare,
  Search,
  Bot,
  UserCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';

type StatusFilter = 'TODOS' | 'AGUARDANDO' | 'RESPONDIDO' | 'VENDEDOR';

function ConversasContent() {
  const navigate = useNavigate();
  const { activeCompanies } = useCompany();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [search, setSearch] = useState('');
  const { trackPageView } = useAnalyticsEvents();

  useEffect(() => {
    trackPageView('conversas');
  }, [trackPageView]);

  const { data: atendimentos = [], isLoading, error } = useAtendimentos({ empresaFilter: activeCompanies });

  const filtered = useMemo(() => {
    let result = atendimentos;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.nome && a.nome.toLowerCase().includes(q)) ||
        (a.telefone && a.telefone.includes(q)) ||
        a.lead_id.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'AGUARDANDO') {
      result = result.filter(a => a.ultima_direcao === 'INBOUND');
    } else if (statusFilter === 'RESPONDIDO') {
      result = result.filter(a => a.ultima_direcao === 'OUTBOUND');
    } else if (statusFilter === 'VENDEDOR') {
      result = result.filter(a => (a as Atendimento & { modo?: string }).modo === 'MANUAL');
    }

    return result;
  }, [atendimentos, search, statusFilter]);

  // Stats
  const totalCount = atendimentos.length;
  const aguardandoCount = atendimentos.filter(a => a.ultima_direcao === 'INBOUND').length;
  const manualCount = atendimentos.filter(a => (a as Atendimento & { modo?: string }).modo === 'MANUAL').length;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessagesSquare className="h-6 w-6 text-primary" />
          Conversas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atendimentos ativos — WhatsApp
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">{totalCount}</Badge>
          <span className="text-muted-foreground">Total</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="destructive" className="bg-warning text-warning-foreground">{aguardandoCount}</Badge>
          <span className="text-muted-foreground">Aguardando</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge>{manualCount}</Badge>
          <span className="text-muted-foreground">Manual</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="AGUARDANDO">Aguardando</SelectItem>
            <SelectItem value="RESPONDIDO">Respondido</SelectItem>
            <SelectItem value="VENDEDOR">Vendedor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Bot className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          Erro ao carregar conversas.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessagesSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Nenhuma conversa encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const isModoManual = (a as Atendimento & { modo?: string }).modo === 'MANUAL';
            const tempoSemResposta = a.ultimo_contato
              ? formatDistanceToNow(new Date(a.ultimo_contato), { locale: ptBR, addSuffix: true })
              : null;

            return (
              <Card
                key={`${a.lead_id}_${a.empresa}`}
                className="cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => navigate(`/leads/${a.lead_id}/${a.empresa}`)}
              >
                <CardContent className="flex items-center gap-4 py-3 px-4">
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {a.nome || 'Lead sem nome'}
                      </span>
                      <Badge variant={a.empresa === 'TOKENIZA' ? 'default' : 'secondary'} className="text-[10px] py-0">
                        {a.empresa}
                      </Badge>
                      {a.estado_funil && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          {a.estado_funil}
                        </Badge>
                      )}
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <ArrowDownLeft className="h-3 w-3" />{a.total_inbound}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <ArrowUpRight className="h-3 w-3" />{a.total_outbound}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ConversasPage() {
  return (
    <AppLayout>
      <ConversasContent />
    </AppLayout>
  );
}
