import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquareText, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Topic {
  tema: string;
  frequencia: number;
  sentimento: 'positivo' | 'neutro' | 'negativo';
  resumo: string;
}

interface WordCloudItem {
  palavra: string;
  contagem: number;
}

interface TrendingData {
  topics: Topic[];
  wordCloud: WordCloudItem[];
  updated_at?: string;
  total_responses?: number;
}

const sentimentColors: Record<string, string> = {
  positivo: 'bg-green-100 text-green-800',
  neutro: 'bg-yellow-100 text-yellow-800',
  negativo: 'bg-red-100 text-red-800',
};

export function CSTrendingTopicsCard({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();

  const { data: trendingData } = useQuery({
    queryKey: ['cs-trending-topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'cs.trending_topics')
        .maybeSingle();
      if (error) throw error;
      return (data?.value as unknown as TrendingData) ?? null;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cs-scheduled-jobs', { body: { action: 'trending-topics' } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-trending-topics'] });
      toast.success('Trending topics atualizados!');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const topics = trendingData?.topics ?? [];
  const wordCloud = trendingData?.wordCloud ?? [];
  const maxCount = Math.max(...wordCloud.map(w => w.contagem), 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-chart-4" />
          Trending Topics
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem dados. Clique em atualizar para analisar respostas.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {topics.slice(0, compact ? 3 : 5).map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.tema}</p>
                    {!compact && <p className="text-xs text-muted-foreground truncate">{t.resumo}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{t.frequencia}x</span>
                    <Badge variant="outline" className={sentimentColors[t.sentimento]}>
                      {t.sentimento}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {!compact && wordCloud.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Word Cloud</p>
                <div className="flex flex-wrap gap-1.5">
                  {wordCloud.slice(0, 20).map((w, i) => {
                    const size = 0.7 + (w.contagem / maxCount) * 0.6;
                    return (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground"
                        style={{ fontSize: `${size}rem` }}
                      >
                        {w.palavra}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {trendingData?.total_responses && (
          <p className="text-xs text-muted-foreground text-center">
            Baseado em {trendingData.total_responses} respostas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
