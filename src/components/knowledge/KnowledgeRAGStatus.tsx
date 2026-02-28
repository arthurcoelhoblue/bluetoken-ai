import { useState } from "react";
import { RefreshCw, Brain, Database, FileText, HelpCircle, Loader2, CheckCircle2, TrendingUp, Zap, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useKnowledgeEmbeddingStats, useKnowledgeSectionCount, useReindexKnowledge, useKnowledgeFeedbackStats, useRunFeedbackLearner } from "@/hooks/useKnowledgeEmbeddings";
import { toast } from "sonner";

export function KnowledgeRAGStatus() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useKnowledgeEmbeddingStats();
  const { data: counts, isLoading: countsLoading } = useKnowledgeSectionCount();
  const { data: feedbackStats } = useKnowledgeFeedbackStats();
  const reindex = useReindexKnowledge();
  const feedbackLearner = useRunFeedbackLearner();
  const [isReindexing, setIsReindexing] = useState(false);
  const [isLearning, setIsLearning] = useState(false);

  const totalSources = (counts?.sections || 0) + (counts?.faqs || 0);
  const totalEmbeddings = stats?.total || 0;
  const coveragePercent = totalSources > 0 ? Math.min(100, Math.round((totalEmbeddings / Math.max(totalSources, 1)) * 100)) : 0;

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const result = await reindex.mutateAsync(undefined);
      toast.success(`Reindexação concluída: ${result?.embedded || 0} chunks (semantic chunking), ${result?.errors || 0} erros`);
      refetchStats();
    } catch (error) {
      toast.error("Erro na reindexação. Verifique os logs.");
    } finally {
      setIsReindexing(false);
    }
  };

  const handleLearn = async () => {
    setIsLearning(true);
    try {
      const result = await feedbackLearner.mutateAsync();
      toast.success(`Aprendizado concluído: ${result?.boosted_chunks || 0} chunks otimizados, ${result?.suggested_faqs || 0} FAQs sugeridas`);
    } catch (error) {
      toast.error("Erro no aprendizado. Verifique os logs.");
    } finally {
      setIsLearning(false);
    }
  };

  if (statsLoading || countsLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">RAG — Busca Híbrida com ML</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLearn}
              disabled={isLearning}
            >
              {isLearning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              {isLearning ? "Aprendendo..." : "Aprender"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReindex}
              disabled={isReindexing}
            >
              {isReindexing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isReindexing ? "Reindexando..." : "Reindexar"}
            </Button>
          </div>
        </div>
        <CardDescription>
          Pipeline: Query Expansion → Hybrid Search (RRF) → Re-Ranking IA → Feedback Loop
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coverage bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cobertura de indexação</span>
            <span className="font-medium">
              {totalEmbeddings > 0 ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {totalEmbeddings} chunks (semantic)
                </span>
              ) : (
                <span className="text-amber-600">Não indexado</span>
              )}
            </span>
          </div>
          <Progress value={coveragePercent} className="h-2" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold">{counts?.sections || 0}</div>
            <div className="text-xs text-muted-foreground">Seções</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <HelpCircle className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold">{counts?.faqs || 0}</div>
            <div className="text-xs text-muted-foreground">FAQs ativas</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Database className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold">{totalEmbeddings}</div>
            <div className="text-xs text-muted-foreground">Embeddings</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <Zap className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold">
              {feedbackStats?.efficacyRate != null ? `${feedbackStats.efficacyRate}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">Eficácia (7d)</div>
          </div>
        </div>

        {/* Feedback stats */}
        {feedbackStats && feedbackStats.total > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4 text-primary" />
              Feedback Loop (últimos 7 dias)
            </div>
            <div className="flex gap-2 flex-wrap text-xs">
              <Badge variant="default" className="bg-green-600">{feedbackStats.util} úteis</Badge>
              <Badge variant="destructive">{feedbackStats.naoUtil} não úteis</Badge>
              <Badge variant="secondary">{feedbackStats.pendente} pendentes</Badge>
              <Badge variant="outline">{feedbackStats.total} total</Badge>
            </div>
          </div>
        )}

        {/* By empresa */}
        {stats?.byEmpresa && Object.keys(stats.byEmpresa).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(stats.byEmpresa).map(([empresa, count]) => (
              <Badge key={empresa} variant="secondary" className="text-xs">
                {empresa}: {count} chunks
              </Badge>
            ))}
          </div>
        )}

        {totalEmbeddings === 0 && (
          <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3">
            ⚠️ Nenhum embedding gerado ainda. Clique em "Reindexar" para ativar a busca híbrida com semantic chunking.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
