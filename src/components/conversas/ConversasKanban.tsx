import { useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConversaCard } from './ConversaCard';
import type { Atendimento } from '@/hooks/useAtendimentos';

interface ConversasKanbanProps {
  atendimentos: Atendimento[];
}

interface KanbanColumn {
  id: string;
  nome: string;
  cor: string;
  posicao: number;
  items: Atendimento[];
}

export function ConversasKanban({ atendimentos }: ConversasKanbanProps) {
  const columns = useMemo(() => {
    const stageMap = new Map<string, KanbanColumn>();
    const semDeal: Atendimento[] = [];

    for (const a of atendimentos) {
      if (!a.deal_stage_id || !a.deal_stage_nome) {
        semDeal.push(a);
        continue;
      }
      const existing = stageMap.get(a.deal_stage_id);
      if (existing) {
        existing.items.push(a);
      } else {
        stageMap.set(a.deal_stage_id, {
          id: a.deal_stage_id,
          nome: a.deal_stage_nome,
          cor: a.deal_stage_cor || 'hsl(var(--muted-foreground))',
          posicao: a.deal_stage_posicao ?? 999,
          items: [a],
        });
      }
    }

    const sorted = Array.from(stageMap.values()).sort((a, b) => a.posicao - b.posicao);

    // Regra anti-limbo: conversas sem deal não aparecem no kanban
    return sorted;
  }, [atendimentos]);

  if (columns.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma conversa para exibir no Kanban.
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {columns.map((col) => (
          <div key={col.id} className="w-[320px] shrink-0 flex flex-col">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: col.cor }}
              />
              <span className="text-sm font-semibold truncate">{col.nome}</span>
              <Badge variant="secondary" className="text-[10px] py-0 ml-auto">
                {col.items.length}
              </Badge>
            </div>

            {/* Column content */}
            <div className="space-y-2 flex-1">
              {col.items.map((a) => (
                <ConversaCard
                  key={`${a.lead_id}_${a.empresa}`}
                  atendimento={a}
                  compact
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
