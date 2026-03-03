import { useState, useMemo, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAtendimentos, type Atendimento } from '@/hooks/useAtendimentos';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  MessagesSquare,
  Search,
  Bot,
  AlertCircle,
  List,
  Columns3,
} from 'lucide-react';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';
import { ConversaCard } from '@/components/conversas/ConversaCard';
import { ConversasFilters, type SmartFilter } from '@/components/conversas/ConversasFilters';
import { ConversasKanban } from '@/components/conversas/ConversasKanban';

type ViewMode = 'lista' | 'kanban';

// --- AI Priority scoring ---
function calcAiPriority(a: Atendimento): number {
  // Temperature weight (40%)
  const tempMap: Record<string, number> = { QUENTE: 1, MORNO: 0.5, FRIO: 0.1 };
  const tempScore = tempMap[a.temperatura ?? ''] ?? 0.3;

  // SLA weight (30%) — hours since last inbound without response
  let slaScore = 0;
  if (a.last_inbound_at && a.ultima_direcao === 'INBOUND') {
    const hoursAgo = (Date.now() - new Date(a.last_inbound_at).getTime()) / 3600000;
    slaScore = Math.min(1, hoursAgo / 8); // Normalized: 8h = max urgency
  }

  // Intent weight (20%)
  const highIntents = ['INTERESSE_COMPRA', 'AGENDAMENTO_REUNIAO'];
  const intentScore = highIntents.includes(a.ultimo_intent ?? '') ? 1 : 0.3;

  // Engagement weight (10%)
  const engScore = (a.score_engajamento ?? 0) / 100;

  return tempScore * 40 + slaScore * 30 + intentScore * 20 + engScore * 10;
}

// --- Filter logic helpers ---
function isSlaEstourado(a: Atendimento): boolean {
  if (!a.last_inbound_at || a.ultima_direcao !== 'INBOUND') return false;
  const hoursAgo = (Date.now() - new Date(a.last_inbound_at).getTime()) / 3600000;
  return hoursAgo > 2;
}

function isEsfriando(a: Atendimento): boolean {
  if (!a.temperatura || !['QUENTE', 'MORNO'].includes(a.temperatura)) return false;
  if (!a.ultimo_contato) return false;
  const hoursAgo = (Date.now() - new Date(a.ultimo_contato).getTime()) / 3600000;
  return hoursAgo > 24;
}

function isIntencaoCompra(a: Atendimento): boolean {
  return ['INTERESSE_COMPRA', 'AGENDAMENTO_REUNIAO'].includes(a.ultimo_intent ?? '');
}

function ConversasContent() {
  const { activeCompanies } = useCompany();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [smartFilter, setSmartFilter] = useState<SmartFilter>('TODOS');
  const [aiSortActive, setAiSortActive] = useState(false);
  const [search, setSearch] = useState('');
  const { trackPageView } = useAnalyticsEvents();

  useEffect(() => {
    trackPageView('conversas');
  }, [trackPageView]);

  const { data: atendimentos = [], isLoading, error } = useAtendimentos({
    empresaFilter: activeCompanies,
    userId: user?.id,
    isAdmin,
  });

  // Compute filter counts
  const counts = useMemo(() => {
    const aguardando = atendimentos.filter(a => a.modo === 'MANUAL' && a.ultima_direcao === 'INBOUND').length;
    const slaEstourado = atendimentos.filter(isSlaEstourado).length;
    const esfriando = atendimentos.filter(isEsfriando).length;
    const intencaoCompra = atendimentos.filter(isIntencaoCompra).length;
    const naoLidas = atendimentos.filter(a => a.ultima_direcao === 'INBOUND').length;
    return {
      total: atendimentos.length,
      aguardando,
      slaEstourado,
      esfriando,
      intencaoCompra,
      naoLidas,
    };
  }, [atendimentos]);

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

    // Smart filter
    switch (smartFilter) {
      case 'AGUARDANDO':
        result = result.filter(a => a.modo === 'MANUAL' && a.ultima_direcao === 'INBOUND');
        break;
      case 'SLA_ESTOURADO':
        result = result.filter(isSlaEstourado);
        break;
      case 'ESFRIANDO':
        result = result.filter(isEsfriando);
        break;
      case 'INTENCAO_COMPRA':
        result = result.filter(isIntencaoCompra);
        break;
      case 'NAO_LIDAS':
        result = result.filter(a => a.ultima_direcao === 'INBOUND');
        break;
    }

    // AI sort
    if (aiSortActive) {
      result = [...result].sort((a, b) => calcAiPriority(b) - calcAiPriority(a));
    }

    return result;
  }, [atendimentos, search, smartFilter, aiSortActive]);

  const handleToggleAiSort = useCallback(() => setAiSortActive(v => !v), []);

  return (
    <div className="container mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessagesSquare className="h-6 w-6 text-primary" />
            Conversas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atendimentos ativos — WhatsApp
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
          className="border rounded-lg"
        >
          <ToggleGroupItem value="lista" aria-label="Modo lista" className="gap-1.5 text-xs px-3">
            <List className="h-4 w-4" />
            Lista
          </ToggleGroupItem>
          <ToggleGroupItem value="kanban" aria-label="Modo kanban" className="gap-1.5 text-xs px-3">
            <Columns3 className="h-4 w-4" />
            Kanban
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ConversasFilters
          activeFilter={smartFilter}
          onFilterChange={setSmartFilter}
          aiSortActive={aiSortActive}
          onToggleAiSort={handleToggleAiSort}
          counts={counts}
        />
      </div>

      {/* Content */}
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
      ) : viewMode === 'kanban' ? (
        <ConversasKanban atendimentos={filtered} />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <ConversaCard
              key={`${a.lead_id}_${a.empresa}`}
              atendimento={a}
            />
          ))}
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
