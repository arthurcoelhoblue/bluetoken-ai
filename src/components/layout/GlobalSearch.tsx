import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { User, Briefcase, Building2, Search, StickyNote, CheckSquare, MessageSquare } from 'lucide-react';

type ResultType = 'contact' | 'deal' | 'organization' | 'note' | 'activity' | 'message';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: ResultType;
  path: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { activeCompanies } = useCompany();

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const searchTerm = `%${query}%`;

      // 1. Contacts — busca por nome, email E telefone
      let contactsQuery = supabase
        .from('contacts')
        .select('id, nome, email, telefone, empresa')
        .or(`nome.ilike.${searchTerm},email.ilike.${searchTerm},telefone.ilike.${searchTerm}`)
        .limit(5);
      contactsQuery = contactsQuery.in('empresa', activeCompanies);

      // 2. Deals — busca por título
      let dealsQuery = supabase
        .from('deals')
        .select('id, titulo, valor, pipelines!inner(empresa)')
        .ilike('titulo', searchTerm)
        .limit(5);
      dealsQuery = dealsQuery.in('pipelines.empresa', activeCompanies);

      // 3. Organizations — busca por nome
      let orgsQuery = supabase
        .from('organizations')
        .select('id, nome, empresa')
        .ilike('nome', searchTerm)
        .limit(5);
      orgsQuery = orgsQuery.in('empresa', activeCompanies);

      // 4. Deal Notes — busca por conteúdo das notas
      const notesQuery = supabase
        .from('deal_notes')
        .select('id, conteudo, deal_id, deals!inner(titulo, pipelines!inner(empresa))')
        .ilike('conteudo', searchTerm)
        .limit(5);

      // 5. Deal Activities (tarefas) — busca por descrição
      const activitiesQuery = supabase
        .from('deal_activities')
        .select('id, descricao, tipo, deal_id, deals!inner(titulo, pipelines!inner(empresa))')
        .ilike('descricao', searchTerm)
        .limit(5);

      // 6. Lead Messages — busca por conteúdo de mensagens
      const messagesQuery = supabase
        .from('lead_messages')
        .select('id, conteudo, lead_id, remetente, empresa')
        .ilike('conteudo', searchTerm)
        .in('empresa', activeCompanies)
        .limit(5);

      const [contactsRes, dealsRes, orgsRes, notesRes, activitiesRes, messagesRes] = await Promise.all([
        contactsQuery,
        dealsQuery,
        orgsQuery,
        notesQuery,
        activitiesQuery,
        messagesQuery,
      ]);

      const items: SearchResult[] = [];

      // Contacts
      contactsRes.data?.forEach((c) => {
        items.push({
          id: c.id,
          label: c.nome,
          sublabel: c.email || c.telefone || undefined,
          type: 'contact',
          path: `/contatos?open=${c.id}`,
        });
      });

      // Deals
      dealsRes.data?.forEach((d) => {
        const dealData = d as unknown as { id: string; titulo: string; valor: number | null };
        items.push({
          id: dealData.id,
          label: dealData.titulo,
          sublabel: dealData.valor ? `R$ ${Number(dealData.valor).toLocaleString('pt-BR')}` : undefined,
          type: 'deal',
          path: `/pipeline?deal=${dealData.id}`,
        });
      });

      // Organizations
      orgsRes.data?.forEach((o) => {
        items.push({
          id: o.id,
          label: o.nome,
          type: 'organization',
          path: `/organizacoes?open=${o.id}`,
        });
      });

      // Notes
      notesRes.data?.forEach((n) => {
        const noteData = n as unknown as { id: string; conteudo: string; deal_id: string; deals: { titulo: string } };
        const preview = noteData.conteudo?.substring(0, 80) + (noteData.conteudo?.length > 80 ? '...' : '');
        items.push({
          id: noteData.id,
          label: preview,
          sublabel: `Nota em: ${noteData.deals?.titulo || 'Deal'}`,
          type: 'note',
          path: `/pipeline?deal=${noteData.deal_id}`,
        });
      });

      // Activities (tarefas)
      activitiesRes.data?.forEach((a) => {
        const actData = a as unknown as { id: string; descricao: string; tipo: string; deal_id: string; deals: { titulo: string } };
        items.push({
          id: actData.id,
          label: actData.descricao?.substring(0, 80) || actData.tipo,
          sublabel: `Tarefa em: ${actData.deals?.titulo || 'Deal'}`,
          type: 'activity',
          path: `/pipeline?deal=${actData.deal_id}`,
        });
      });

      // Messages
      messagesRes.data?.forEach((m) => {
        const msgData = m as unknown as { id: string; conteudo: string; lead_id: string; remetente: string };
        const preview = msgData.conteudo?.substring(0, 80) + (msgData.conteudo?.length > 80 ? '...' : '');
        items.push({
          id: msgData.id,
          label: preview,
          sublabel: `Mensagem de: ${msgData.remetente === 'LEAD' ? 'Lead' : 'Sistema'}`,
          type: 'message',
          path: `/conversas?lead=${msgData.lead_id}`,
        });
      });

      setResults(items);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeCompanies]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery('');
      navigate(result.path);
    },
    [navigate]
  );

  const iconMap: Record<ResultType, typeof User> = {
    contact: User,
    deal: Briefcase,
    organization: Building2,
    note: StickyNote,
    activity: CheckSquare,
    message: MessageSquare,
  };

  const groupLabel: Record<ResultType, string> = {
    contact: 'Contatos',
    deal: 'Deals',
    organization: 'Organizações',
    note: 'Notas',
    activity: 'Tarefas',
    message: 'Mensagens',
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm text-muted-foreground w-56 hover:bg-muted/80 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar tudo...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar contatos, deals, notas, tarefas, mensagens..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isSearching && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Buscando...
            </div>
          )}
          {!isSearching && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          )}
          {!isSearching && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = iconMap[type as ResultType];
            return (
              <CommandGroup key={type} heading={groupLabel[type as ResultType]}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.sublabel || ''}`}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground truncate">{item.sublabel}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
