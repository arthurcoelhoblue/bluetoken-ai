import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Sparkles, MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCopilotMessages } from '@/hooks/useCopilotMessages';
import { useCopilotInsights } from '@/hooks/useCopilotInsights';
import { CopilotInsightCard } from './CopilotInsightCard';
import type { CopilotContextType } from '@/types/conversas';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';

interface CopilotContext {
  type: CopilotContextType;
  id?: string;
  empresa: string;
  leadNome?: string;
  estadoFunil?: string;
  framework?: string;
}

interface CopilotPanelProps {
  context: CopilotContext;
  variant?: 'icon' | 'button' | 'fab';
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const QUICK_SUGGESTIONS: Record<CopilotContextType, string[]> = {
  LEAD: [
    'Qual a melhor abordagem para este lead?',
    'Sugira uma mensagem de follow-up',
    'Resuma o perfil deste lead',
  ],
  DEAL: [
    'Qual o risco de perder este deal?',
    'Sugira próximos passos',
  ],
  PIPELINE: [
    'Qual o gargalo atual do pipeline?',
  ],
  GERAL: [
    'Como está minha performance esta semana?',
    'Quais ações devo priorizar hoje?',
    'Dicas para melhorar minha taxa de conversão',
    'Resumo do meu pipeline atual',
  ],
  CUSTOMER: [
    'Qual a saúde deste cliente?',
    'Quais incidências estão abertas?',
    'Sugira ações para reduzir risco de churn',
  ],
};

export function CopilotPanel({ context, variant = 'button', externalOpen, onOpenChange }: CopilotPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      abortRef.current?.abort();
      setIsLoading(false);
    }
    if (isControlled) {
      (onOpenChange ?? setInternalOpen)(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  const {
    messages, isLoading: historyLoading, saveMessage, saveMessageQuiet, clearHistory,
    addLocalMessage, updateLastMessage, sessionBreaks,
  } = useCopilotMessages({
    contextType: context.type,
    contextId: context.id,
    empresa: context.empresa,
    enabled: open,
  });

  const { insights, generateInsights, dismissInsight, pendingCount } = useCopilotInsights(context.empresa);
  const { trackFeatureUse } = useAnalyticsEvents();

  // Resolve lead names for insights
  const leadIds = useMemo(() => {
    const ids = insights.map(i => i.lead_id).filter(Boolean) as string[];
    return [...new Set(ids)];
  }, [insights]);

  const { data: leadNames } = useQuery({
    queryKey: ['insight-lead-names', leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from('contacts')
        .select('id, nome')
        .in('id', leadIds);
      const map: Record<string, string> = {};
      (data || []).forEach(c => { map[c.id] = c.nome; });
      return map;
    },
    enabled: leadIds.length > 0,
  });

  // Generate proactive insights when opening
  useEffect(() => {
    if (open && context.type === 'GERAL') {
      generateInsights();
    }
  }, [open, context.type, generateInsights]);

  useEffect(() => {
    if (open) trackFeatureUse('copilot_opened', { context: context.type });
  }, [open, trackFeatureUse, context.type]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const suggestions = QUICK_SUGGESTIONS[context.type] || QUICK_SUGGESTIONS.GERAL;

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSendingRef.current) return;
    isSendingRef.current = true;
    const trimmed = content.trim();
    setInput('');
    setIsLoading(true);

    await saveMessage('user', trimmed);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const allMsgs = [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: trimmed }];
    const payload = {
      messages: allMsgs,
      contextType: context.type,
      contextId: context.id,
      empresa: context.empresa,
    };
    const url = `${supabaseUrl}/functions/v1/copilot-chat`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    };

    let didFallback = false;

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const streamStartTimeout = setTimeout(() => {
        controller.abort();
      }, 20000);

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(streamStartTimeout);

      if (!resp.ok) {
        if (resp.status === 429) {
          toast({ title: 'Rate limit', description: 'Muitas requisições. Aguarde alguns segundos.', variant: 'destructive' });
        } else if (resp.status === 402) {
          toast({ title: 'Créditos insuficientes', description: 'Adicione créditos de IA ao workspace.', variant: 'destructive' });
        }
        throw new Error(`HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      addLocalMessage('assistant', '');
      let assistantContent = '';
      let metaData: { model?: string; tokens_input?: number; tokens_output?: number; latency_ms?: number } = {};

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const INACTIVITY_TIMEOUT_MS = 30_000;
      let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
      const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          controller.abort();
        }, INACTIVITY_TIMEOUT_MS);
      };
      resetInactivityTimer();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetInactivityTimer();
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                updateLastMessage(assistantContent);
              }
              if (parsed.meta) metaData = parsed.meta;
            } catch { /* skip */ }
          }
        }
      } finally {
        if (inactivityTimer) clearTimeout(inactivityTimer);
      }

      if (assistantContent) {
        await saveMessageQuiet('assistant', assistantContent, {
          model_used: metaData.model,
          tokens_input: metaData.tokens_input,
          tokens_output: metaData.tokens_output,
          latency_ms: metaData.latency_ms,
        });
      }

      trackFeatureUse('copilot_message_sent', { context: context.type, model: metaData.model });
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';

      // Auto-retry non-streaming on abort (timeout/watchdog)
      if (isAbort && !didFallback) {
        didFallback = true;
        try {
          addLocalMessage('assistant', '');
          const fallbackResp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...payload, stream: false }),
          });
          if (fallbackResp.ok) {
            const fallbackData = await fallbackResp.json();
            const fallbackContent = fallbackData.choices?.[0]?.message?.content || fallbackData.content || '';
            if (fallbackContent) {
              updateLastMessage(fallbackContent);
              await saveMessageQuiet('assistant', fallbackContent, {
                model_used: fallbackData.meta?.model,
                tokens_input: fallbackData.meta?.tokens_input,
                tokens_output: fallbackData.meta?.tokens_output,
                latency_ms: fallbackData.meta?.latency_ms,
              });
              trackFeatureUse('copilot_message_sent', { context: context.type, fallback: true });
              return; // success via fallback
            }
          }
        } catch { /* fallback also failed, show error below */ }
      }

      if (!didFallback || true) {
        addLocalMessage('assistant', isAbort
          ? '⏱️ A Amélia demorou demais para responder. Tente novamente em alguns instantes.'
          : '⚠️ Não foi possível obter resposta da Amélia. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  }, [messages, context, saveMessage, addLocalMessage, updateLastMessage, saveMessageQuiet, trackFeatureUse]);

  const trigger = variant === 'icon' ? (
    <Button variant="ghost" size="icon" className="h-8 w-8 relative">
      <Sparkles className="h-4 w-4" />
      {pendingCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </Button>
  ) : variant === 'fab' ? (
    <Button size="icon" className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50 relative">
      <Bot className="h-5 w-5" />
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="gap-1.5">
      <Sparkles className="h-3.5 w-3.5" />
      Copilot
      {pendingCount > 0 && (
        <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{pendingCount}</Badge>
      )}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {!isControlled && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="w-[440px] sm:max-w-[440px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Amélia Copilot
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </SheetTitle>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory} title="Limpar histórico">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4">
          {/* Proactive Insights */}
          {insights.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">💡 Insights da Amélia</p>
              {insights.map(insight => (
                <CopilotInsightCard key={insight.id} insight={insight} onDismiss={dismissInsight} leadNome={leadNames?.[insight.lead_id || ''] || null} empresa={context.empresa} />
              ))}
            </div>
          )}

          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Pergunte à Amélia sobre este {context.type.toLowerCase()}.
              </p>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-sm p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5 inline mr-2 text-muted-foreground" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={msg.id}>
                  {sessionBreaks.has(i) && (
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 border-t" />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Nova conversa</span>
                      <div className="flex-1 border-t" />
                    </div>
                  )}
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] p-3 rounded-lg text-sm break-words ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-none whitespace-pre-wrap'
                          : 'bg-muted rounded-bl-none'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg rounded-bl-none">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                      <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        <div className="flex items-end gap-2 pt-2 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Pergunte à Amélia..."
            className="min-h-[40px] max-h-[80px] resize-none flex-1"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
