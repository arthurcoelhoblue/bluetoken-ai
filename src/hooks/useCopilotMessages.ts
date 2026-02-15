import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { CopilotContextType } from '@/types/conversas';

export interface CopilotMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface UseCopilotMessagesProps {
  contextType: CopilotContextType;
  contextId?: string;
  empresa: string;
  enabled: boolean;
}

const SESSION_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

export function useCopilotMessages({ contextType, contextId, empresa, enabled }: UseCopilotMessagesProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CopilotMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user?.id || !enabled) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('copilot_messages')
        .select('id, role, content, created_at')
        .eq('user_id', user.id)
        .eq('context_type', contextType)
        .eq('empresa', empresa as never)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      type CopilotRow = { id: string; role: string; content: string; created_at: string; context_id?: string | null };
      const filtered = (data || [])
        .filter((m) => {
          const row = m as CopilotRow;
          if (!contextId) return !row.context_id || row.context_id === '';
          return row.context_id === contextId;
        })
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          created_at: m.created_at,
        }));

      setMessages(filtered);
    } catch (err) {
      console.error('[CopilotMessages] Erro ao carregar histórico:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, contextType, contextId, empresa, enabled]);

  useEffect(() => {
    if (enabled) loadHistory();
  }, [enabled, loadHistory]);

  const saveMessage = useCallback(async (role: 'user' | 'assistant', content: string, meta?: { model_used?: string; tokens_input?: number; tokens_output?: number; latency_ms?: number }) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('copilot_messages')
        .insert({
          user_id: user.id,
          context_type: contextType,
          context_id: contextId || null,
          empresa: empresa as never,
          role,
          content,
          model_used: meta?.model_used || null,
          tokens_input: meta?.tokens_input || null,
          tokens_output: meta?.tokens_output || null,
          latency_ms: meta?.latency_ms || null,
        })
        .select('id, role, content, created_at')
        .single();

      if (error) throw error;

      const msg: CopilotMsg = {
        id: data.id,
        role: data.role as 'user' | 'assistant',
        content: data.content,
        created_at: data.created_at,
      };

      setMessages(prev => [...prev, msg]);
      return msg;
    } catch (err) {
      console.error('[CopilotMessages] Erro ao salvar mensagem:', err);
      return null;
    }
  }, [user?.id, contextType, contextId, empresa]);

  const clearHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('copilot_messages')
        .delete()
        .eq('user_id', user.id)
        .eq('context_type', contextType)
        .eq('empresa', empresa as never);

      if (contextId) {
        query = query.eq('context_id', contextId);
      }

      await query;
      setMessages([]);
    } catch (err) {
      console.error('[CopilotMessages] Erro ao limpar histórico:', err);
    }
  }, [user?.id, contextType, contextId, empresa]);

  const addLocalMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const msg: CopilotMsg = {
      id: crypto.randomUUID(),
      role,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  // Compute session breaks for UI
  const sessionBreaks = new Set<number>();
  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i - 1].created_at).getTime();
    const curr = new Date(messages[i].created_at).getTime();
    if (curr - prev > SESSION_GAP_MS) {
      sessionBreaks.add(i);
    }
  }

  return {
    messages,
    isLoading,
    saveMessage,
    clearHistory,
    addLocalMessage,
    sessionBreaks,
    reload: loadHistory,
  };
}
