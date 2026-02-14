import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tags, X, Plus, Search } from 'lucide-react';
import { useActiveTokenizaOffers } from '@/hooks/useTokenizaOffers';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  dealId: string;
  tags: string[];
}

export function DealTagsEditor({ dealId, tags }: Props) {
  const [open, setOpen] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [search, setSearch] = useState('');
  const { activeOffers } = useActiveTokenizaOffers();
  const qc = useQueryClient();

  const offerTags = activeOffers.map(o => o.nome);

  const allSuggestions = [...new Set([...offerTags])].filter(t =>
    !search || t.toLowerCase().includes(search.toLowerCase())
  );

  const updateTags = async (newTags: string[]) => {
    const { error } = await supabase
      .from('deals')
      .update({ tags: newTags } as any)
      .eq('id', dealId);
    if (error) {
      toast.error('Erro ao atualizar tags');
      return;
    }
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['deal-detail', dealId] });
  };

  const toggleTag = (tag: string) => {
    const newTags = tags.includes(tag)
      ? tags.filter(t => t !== tag)
      : [...tags, tag];
    updateTags(newTags);
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    updateTags([...tags, trimmed]);
    setCustomTag('');
  };

  const removeTag = (tag: string) => {
    updateTags(tags.filter(t => t !== tag));
  };

  return (
    <div className="py-2 px-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Tags className="h-3 w-3" /> Tags
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-3" align="end">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tag..."
                className="h-8 pl-7 text-xs"
              />
            </div>

            {allSuggestions.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                <span className="text-[10px] text-muted-foreground font-medium">Ofertas Tokeniza</span>
                {allSuggestions.map(tag => (
                  <label key={tag} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                    <Checkbox
                      checked={tags.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    <span className="truncate">{tag}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-1 pt-1 border-t">
              <Input
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                placeholder="Tag personalizada"
                className="h-7 text-xs"
                onKeyDown={e => e.key === 'Enter' && addCustomTag()}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addCustomTag}>
                Add
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhuma tag</p>
      )}
    </div>
  );
}
