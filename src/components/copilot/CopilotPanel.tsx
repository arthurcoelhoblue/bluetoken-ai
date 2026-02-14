import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Sparkles, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { CopilotContextType } from '@/types/conversas';

interface CopilotContext {
  type: CopilotContextType;
  id?: string;
  empresa: string;
  leadNome?: string;
  estadoFunil?: string;
  framework?: string;
}

interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CopilotPanelProps {
  context: CopilotContext;
  variant?: 'icon' | 'button' | 'fab';
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
    'Como melhorar minha taxa de conversão?',
  ],
};

export function CopilotPanel({ context, variant = 'button' }: CopilotPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const suggestions = QUICK_SUGGESTIONS[context.type] || QUICK_SUGGESTIONS.GERAL;

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMsg: LocalMessage = { role: 'user', content: content.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('copilot-chat', {
        body: {
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          contextType: context.type,
          contextId: context.id,
          empresa: context.empresa,
        },
      });

      if (error) {
        // Check for rate limit or payment errors
        const status = (error as Record<string, unknown>)?.status ?? (error as Record<string, unknown> & { context?: { status?: number } })?.context?.status;
        if (status === 429) {
          toast({ title: 'Rate limit', description: 'Muitas requisições. Aguarde alguns segundos.', variant: 'destructive' });
        } else if (status === 402) {
          toast({ title: 'Créditos insuficientes', description: 'Adicione créditos de IA ao workspace.', variant: 'destructive' });
        }
        throw error;
      }

      const assistantMsg: LocalMessage = {
        role: 'assistant',
        content: data?.content || 'Sem resposta da IA.',
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[Copilot] Erro:', err);
      const errorMsg: LocalMessage = {
        role: 'assistant',
        content: '⚠️ Não foi possível obter resposta da Amélia. Tente novamente.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const trigger = variant === 'icon' ? (
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <Sparkles className="h-4 w-4" />
    </Button>
  ) : variant === 'fab' ? (
    <Button size="icon" className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50">
      <Bot className="h-5 w-5" />
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="gap-1.5">
      <Sparkles className="h-3.5 w-3.5" />
      Copilot
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-[440px] sm:max-w-[440px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Amélia Copilot
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 py-4">
          {messages.length === 0 ? (
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
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-lg text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted rounded-bl-none'
                    }`}
                  >
                    {msg.content}
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
