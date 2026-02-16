import { useState } from 'react';
import { Search, ChevronDown, FileText, BookOpen, Users, Shield, Code, HeartPulse, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getWikiPagesByGroup, type WikiPage } from '@/config/wikiContent';

const GROUP_ICONS: Record<string, React.ElementType> = {
  'Geral': BookOpen,
  'Vendedor': Briefcase,
  'Sucesso do Cliente': HeartPulse,
  'Gestor': Users,
  'Administrador': Shield,
  'Desenvolvedor': Code,
};

interface WikiSidebarProps {
  activeSlug: string;
  onSelect: (slug: string) => void;
}

export function WikiSidebar({ activeSlug, onSelect }: WikiSidebarProps) {
  const [search, setSearch] = useState('');
  const groups = getWikiPagesByGroup();

  const filteredGroups = Object.entries(groups).reduce((acc, [group, pages]) => {
    if (!search) {
      acc[group] = pages;
      return acc;
    }
    const q = search.toLowerCase();
    const filtered = pages.filter(p => p.title.toLowerCase().includes(q));
    if (filtered.length > 0) acc[group] = filtered;
    return acc;
  }, {} as Record<string, WikiPage[]>);

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar na wiki..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {Object.entries(filteredGroups).map(([group, pages]) => {
            const Icon = GROUP_ICONS[group] || BookOpen;
            const hasActive = pages.some(p => p.slug === activeSlug);
            return (
              <Collapsible key={group} defaultOpen={hasActive || !search}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-accent/50 rounded-md">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{group}</span>
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-2 space-y-0.5 mt-0.5">
                    {pages.map(page => (
                      <button
                        key={page.slug}
                        onClick={() => onSelect(page.slug)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors text-left',
                          activeSlug === page.slug
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground/80 hover:bg-accent/50'
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
