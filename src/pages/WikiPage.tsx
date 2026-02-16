import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { WikiSidebar } from '@/components/wiki/WikiSidebar';
import { WIKI_PAGES } from '@/config/wikiContent';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AppLayout } from '@/components/layout/AppLayout';

export default function WikiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSlug = searchParams.get('page') || 'intro';
  const [mobileOpen, setMobileOpen] = useState(false);

  const activePage = useMemo(
    () => WIKI_PAGES.find(p => p.slug === activeSlug) || WIKI_PAGES[0],
    [activeSlug]
  );

  const handleSelect = (slug: string) => {
    setSearchParams({ page: slug });
    setMobileOpen(false);
  };

  const sidebar = <WikiSidebar activeSlug={activeSlug} onSelect={handleSelect} />;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64 shrink-0">
          {sidebar}
        </div>

        {/* Mobile sidebar */}
        <div className="md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              {sidebar}
            </SheetContent>
          </Sheet>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <article className="max-w-3xl mx-auto px-6 py-8">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg">
              <ReactMarkdown>{activePage.content}</ReactMarkdown>
            </div>
          </article>
        </ScrollArea>
      </div>
    </AppLayout>
  );
}
