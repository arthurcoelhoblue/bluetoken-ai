import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface MentionUser {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function MentionTextarea({ value, onChange, placeholder, className, rows = 2 }: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['mention-users'],
    queryFn: async (): Promise<MentionUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, avatar_url')
        .eq('is_active', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as MentionUser[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtered = mentionSearch
    ? users.filter(u => u.nome?.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 6)
    : users.slice(0, 6);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    onChange(newValue);
    setCursorPos(pos);

    // Detect @ trigger
    const textBefore = newValue.slice(0, pos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionStart(pos - atMatch[0].length);
      setMentionSearch(atMatch[1]);
      setShowSuggestions(true);
      setSelectedIndex(0);

      // Position dropdown
      if (textareaRef.current) {
        const lineHeight = 20;
        const lines = textBefore.split('\n');
        const top = lines.length * lineHeight + 4;
        setDropdownPos({ top, left: 0 });
      }
    } else {
      setShowSuggestions(false);
    }
  }, [onChange]);

  const insertMention = useCallback((user: MentionUser) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPos);
    const mention = `@[${user.nome}](${user.id}) `;
    const newValue = before + mention + after;
    onChange(newValue);
    setShowSuggestions(false);
    setMentionSearch('');

    // Focus and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + mention.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [value, mentionStart, cursorPos, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Display text: replace @[Name](id) with @Name for visual
  const displayValue = value;

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
        rows={rows}
      />

      {showSuggestions && filtered.length > 0 && (
        <div
          className="absolute z-50 w-64 max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {filtered.map((user, idx) => (
            <button
              key={user.id}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer ${
                idx === selectedIndex ? 'bg-accent' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <Avatar className="h-5 w-5">
                {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="text-[9px]">{(user.nome ?? '?')[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate">{user.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Extract user IDs from mention format @[Name](userId) */
export function extractMentionIds(text: string): string[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.push(match[2]);
  }
  return ids;
}

/** Convert @[Name](id) to display text @Name */
export function formatMentionText(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}
