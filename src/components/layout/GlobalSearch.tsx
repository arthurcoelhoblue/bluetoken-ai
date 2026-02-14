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
  CommandSeparator,
} from '@/components/ui/command';
import { User, Briefcase, Building2, Search } from 'lucide-react';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: 'contact' | 'deal' | 'organization';
  path: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

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

      const [contactsRes, dealsRes, orgsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, nome, email, telefone')
          .ilike('nome', searchTerm)
          .limit(5),
        supabase
          .from('deals')
          .select('id, titulo, valor')
          .ilike('titulo', searchTerm)
          .limit(5),
        supabase
          .from('organizations')
          .select('id, nome')
          .ilike('nome', searchTerm)
          .limit(5),
      ]);

      const items: SearchResult[] = [];

      contactsRes.data?.forEach((c) => {
        items.push({
          id: c.id,
          label: c.nome,
          sublabel: c.email || c.telefone || undefined,
          type: 'contact',
          path: `/contatos`,
        });
      });

      dealsRes.data?.forEach((d) => {
        items.push({
          id: d.id,
          label: d.titulo,
          sublabel: d.valor ? `R$ ${Number(d.valor).toLocaleString('pt-BR')}` : undefined,
          type: 'deal',
          path: `/pipeline`,
        });
      });

      orgsRes.data?.forEach((o) => {
        items.push({
          id: o.id,
          label: o.nome,
          type: 'organization',
          path: `/organizacoes`,
        });
      });

      setResults(items);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery('');
      navigate(result.path);
    },
    [navigate]
  );

  const iconMap = {
    contact: User,
    deal: Briefcase,
    organization: Building2,
  };

  const groupLabel = {
    contact: 'Contatos',
    deal: 'Deals',
    organization: 'Organizações',
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
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar contatos, deals, organizações..."
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
          {Object.entries(grouped).map(([type, items], idx) => {
            const Icon = iconMap[type as keyof typeof iconMap];
            return (
              <CommandGroup key={type} heading={groupLabel[type as keyof typeof groupLabel]}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground">{item.sublabel}</span>
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
