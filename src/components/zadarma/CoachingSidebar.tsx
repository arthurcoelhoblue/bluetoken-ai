import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Lightbulb, Shield, MessageSquare, Target, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CoachingData {
  sentimento_atual: string;
  sugestoes: string[];
  objecoes_detectadas: string[];
  framework_tips: string[];
  battlecard: string;
  talk_ratio_hint: string;
}

interface Props {
  dealId?: string;
  isActive: boolean;
}

const sentimentConfig: Record<string, { emoji: string; color: string }> = {
  POSITIVO: { emoji: '😊', color: 'text-success' },
  NEGATIVO: { emoji: '😟', color: 'text-destructive' },
  NEUTRO: { emoji: '😐', color: 'text-muted-foreground' },
};

export function CoachingSidebar({ dealId, isActive }: Props) {
  const [coaching, setCoaching] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCoaching = useCallback(async () => {
    if (!isActive) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('call-coach', {
        body: { deal_id: dealId || null, transcription_chunk: null },
      });

      if (fnErr) throw fnErr;
      setCoaching(data as CoachingData);
    } catch (_e) {
      setError('Erro ao carregar coaching');
    } finally {
      setLoading(false);
    }
  }, [dealId, isActive]);

  // Initial fetch + polling every 15s
  useEffect(() => {
    if (!isActive) return;
    fetchCoaching();
    const interval = setInterval(fetchCoaching, 15000);
    return () => clearInterval(interval);
  }, [fetchCoaching, isActive]);

  if (!isActive) return null;

  const sentiment = sentimentConfig[coaching?.sentimento_atual || 'NEUTRO'] || sentimentConfig.NEUTRO;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Coaching IA</span>
          </div>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {coaching && (
          <>
            {/* Sentiment + Talk Ratio */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-lg">{sentiment.emoji}</span>
                <span className={`text-xs font-medium ${sentiment.color}`}>{coaching.sentimento_atual}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                <MessageSquare className="h-2.5 w-2.5 mr-1" />
                {coaching.talk_ratio_hint}
              </Badge>
            </div>

            <Separator />

            {/* Sugestões */}
            {coaching.sugestoes.length > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-1.5 pt-2 px-2.5">
                  <CardTitle className="text-xs flex items-center gap-1">
                    <Lightbulb className="h-3 w-3 text-primary" /> Sugestões
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2">
                  <ul className="space-y-1">
                    {coaching.sugestoes.map((s, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Objeções */}
            {coaching.objecoes_detectadas.length > 0 && (
              <Card className="border-warning/20 bg-warning/5">
                <CardHeader className="pb-1.5 pt-2 px-2.5">
                  <CardTitle className="text-xs flex items-center gap-1">
                    <Shield className="h-3 w-3 text-warning" /> Objeções
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2">
                  <ul className="space-y-1">
                    {coaching.objecoes_detectadas.map((o, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <span className="text-warning mt-0.5">⚠</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Framework Tips */}
            {coaching.framework_tips.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-1.5 pt-2 px-2.5">
                  <CardTitle className="text-xs flex items-center gap-1">
                    <Target className="h-3 w-3" /> Frameworks
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2">
                  <ul className="space-y-1">
                    {coaching.framework_tips.map((t, i) => (
                      <li key={i} className="text-xs">{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Battlecard */}
            {coaching.battlecard && (
              <Card className="border-accent/20 bg-accent/5">
                <CardHeader className="pb-1.5 pt-2 px-2.5">
                  <CardTitle className="text-xs">🎯 Battlecard</CardTitle>
                </CardHeader>
                <CardContent className="px-2.5 pb-2">
                  <p className="text-xs">{coaching.battlecard}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!coaching && !loading && !error && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aguardando início da chamada...
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
