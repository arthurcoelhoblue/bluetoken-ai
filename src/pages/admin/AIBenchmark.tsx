import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, BarChart3, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BenchmarkRow {
  id: string;
  original_intent_id: string;
  message_id: string;
  modelo_ia: string;
  intent: string;
  intent_confidence: number;
  acao_recomendada: string;
  resposta_automatica_texto: string | null;
  tokens_usados: number | null;
  tempo_processamento_ms: number | null;
  created_at: string;
}

interface OriginalIntent {
  id: string;
  message_id: string;
  intent: string;
  intent_confidence: number;
  acao_recomendada: string;
  resposta_automatica_texto: string | null;
  modelo_ia: string | null;
  tokens_usados: number | null;
  tempo_processamento_ms: number | null;
}

const MODELS = [
  { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
];

export default function AIBenchmark() {
  const [selectedModel, setSelectedModel] = useState('google/gemini-3-pro-preview');
  const [selectedLimit, setSelectedLimit] = useState('20');
  const queryClient = useQueryClient();

  // Buscar benchmarks existentes
  const { data: benchmarks, isLoading: loadingBenchmarks } = useQuery({
    queryKey: ['ai-benchmarks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_model_benchmarks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as BenchmarkRow[];
    },
  });

  // Buscar intents originais para comparação
  const benchmarkIntentIds = benchmarks?.map(b => b.original_intent_id).filter(Boolean) || [];
  const { data: originalIntents } = useQuery({
    queryKey: ['original-intents', benchmarkIntentIds],
    queryFn: async () => {
      if (benchmarkIntentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('lead_message_intents')
        .select('id, message_id, intent, intent_confidence, acao_recomendada, resposta_automatica_texto, modelo_ia, tokens_usados, tempo_processamento_ms')
        .in('id', benchmarkIntentIds);
      if (error) throw error;
      return (data || []) as OriginalIntent[];
    },
    enabled: benchmarkIntentIds.length > 0,
  });

  // Buscar mensagens para exibir conteúdo
  const messageIds = benchmarks?.map(b => b.message_id).filter(Boolean) || [];
  const { data: messages } = useQuery({
    queryKey: ['benchmark-messages', messageIds],
    queryFn: async () => {
      if (messageIds.length === 0) return [];
      const { data, error } = await supabase
        .from('lead_messages')
        .select('id, conteudo, empresa')
        .in('id', messageIds);
      if (error) throw error;
      return data || [];
    },
    enabled: messageIds.length > 0,
  });

  const originalMap = new Map((originalIntents || []).map(o => [o.id, o]));
  const messageMap = new Map((messages || []).map(m => [m.id, m]));

  // Mutation para executar benchmark
  const runBenchmark = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-benchmark', {
        body: { limit: parseInt(selectedLimit), modelo: selectedModel },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Benchmark concluído',
        description: `${data.summary?.total_processadas || 0} mensagens processadas. Concordância intent: ${data.summary?.taxa_concordancia_intent}`,
      });
      queryClient.invalidateQueries({ queryKey: ['ai-benchmarks'] });
    },
    onError: (error) => {
      toast({ title: 'Erro no benchmark', description: String(error), variant: 'destructive' });
    },
  });

  // Mutation para limpar benchmarks
  const clearBenchmarks = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ai_model_benchmarks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Benchmarks limpos' });
      queryClient.invalidateQueries({ queryKey: ['ai-benchmarks'] });
    },
  });

  // Métricas agregadas
  const metrics = (() => {
    if (!benchmarks || benchmarks.length === 0 || !originalIntents) return null;

    let intentMatch = 0;
    let acaoMatch = 0;
    let totalConfOriginal = 0;
    let totalConfBench = 0;
    let totalTokensOrig = 0;
    let totalTokensBench = 0;
    let totalTempoOrig = 0;
    let totalTempoBench = 0;
    let count = 0;

    for (const b of benchmarks) {
      const orig = originalMap.get(b.original_intent_id);
      if (!orig) continue;
      count++;
      if (orig.intent === b.intent) intentMatch++;
      if (orig.acao_recomendada === b.acao_recomendada) acaoMatch++;
      totalConfOriginal += Number(orig.intent_confidence) || 0;
      totalConfBench += Number(b.intent_confidence) || 0;
      totalTokensOrig += orig.tokens_usados || 0;
      totalTokensBench += b.tokens_usados || 0;
      totalTempoOrig += orig.tempo_processamento_ms || 0;
      totalTempoBench += b.tempo_processamento_ms || 0;
    }

    if (count === 0) return null;

    return {
      total: count,
      intentMatchRate: ((intentMatch / count) * 100).toFixed(1),
      acaoMatchRate: ((acaoMatch / count) * 100).toFixed(1),
      avgConfOriginal: (totalConfOriginal / count).toFixed(2),
      avgConfBench: (totalConfBench / count).toFixed(2),
      avgTokensOriginal: Math.round(totalTokensOrig / count),
      avgTokensBench: Math.round(totalTokensBench / count),
      avgTempoOriginal: Math.round(totalTempoOrig / count),
      avgTempoBench: Math.round(totalTempoBench / count),
    };
  })();

  return (
    <div className="container max-w-7xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Benchmark IA</h1>
        <p className="text-muted-foreground">
          Compare modelos de IA reprocessando mensagens históricas (shadow test)
        </p>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Executar Benchmark
          </CardTitle>
          <CardDescription>
            Selecione o modelo e quantidade de mensagens para reprocessar
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">Modelo</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Qtd. Mensagens</label>
            <Select value={selectedLimit} onValueChange={setSelectedLimit}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => runBenchmark.mutate()}
            disabled={runBenchmark.isPending}
          >
            {runBenchmark.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Iniciar Benchmark</>
            )}
          </Button>
          {benchmarks && benchmarks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearBenchmarks.mutate()}
              disabled={clearBenchmarks.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Métricas Agregadas */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Concordância Intent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.intentMatchRate}%</div>
              <p className="text-xs text-muted-foreground">{metrics.total} comparações</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Concordância Ação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.acaoMatchRate}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Confiança Média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <span className="font-semibold">Original:</span> {metrics.avgConfOriginal}
              </div>
              <div className="text-sm">
                <span className="font-semibold">Benchmark:</span> {metrics.avgConfBench}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tokens / Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <span className="font-semibold">Original:</span> {metrics.avgTokensOriginal} tok / {metrics.avgTempoOriginal}ms
              </div>
              <div className="text-sm">
                <span className="font-semibold">Benchmark:</span> {metrics.avgTokensBench} tok / {metrics.avgTempoBench}ms
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela Comparativa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resultados Comparativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBenchmarks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !benchmarks || benchmarks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum benchmark executado ainda. Clique em "Iniciar Benchmark" para começar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Mensagem</TableHead>
                    <TableHead>Intent Original</TableHead>
                    <TableHead>Intent Benchmark</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Conf. Orig.</TableHead>
                    <TableHead>Conf. Bench.</TableHead>
                    <TableHead>Ação Orig.</TableHead>
                    <TableHead>Ação Bench.</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {benchmarks.map(b => {
                    const orig = originalMap.get(b.original_intent_id);
                    const msg = messageMap.get(b.message_id);
                    const intentMatch = orig?.intent === b.intent;
                    const acaoMatch = orig?.acao_recomendada === b.acao_recomendada;

                    return (
                      <TableRow key={b.id} className={!intentMatch ? 'bg-destructive/5' : ''}>
                        <TableCell className="max-w-[200px] truncate text-xs" title={msg?.conteudo}>
                          {msg?.conteudo?.substring(0, 60) || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{orig?.intent || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={intentMatch ? 'outline' : 'destructive'} className="text-xs">
                            {b.intent || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {intentMatch && acaoMatch ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{Number(orig?.intent_confidence || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{Number(b.intent_confidence || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{orig?.acao_recomendada || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={acaoMatch ? 'secondary' : 'destructive'} className="text-xs">
                            {b.acao_recomendada || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {orig?.tokens_usados || 0} / {b.tokens_usados || 0}
                        </TableCell>
                        <TableCell className="text-xs">
                          {orig?.tempo_processamento_ms || 0}ms / {b.tempo_processamento_ms || 0}ms
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
