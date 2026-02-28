import { useState } from "react";
import { RefreshCw, Brain, Database, FileText, HelpCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useKnowledgeEmbeddingStats, useKnowledgeSectionCount, useReindexKnowledge } from "@/hooks/useKnowledgeEmbeddings";
import { toast } from "sonner";

export function KnowledgeRAGStatus() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useKnowledgeEmbeddingStats();
  const { data: counts, isLoading: countsLoading } = useKnowledgeSectionCount();
  const reindex = useReindexKnowledge();
  const [isReindexing, setIsReindexing] = useState(false);

  const totalSources = (counts?.sections || 0) + (counts?.faqs || 0);
  const totalEmbeddings = stats?.total || 0;
  const coveragePercent = totalSources > 0 ? Math.min(100, Math.round((totalEmbeddings / Math.max(totalSources, 1)) * 100)) : 0;

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const result = await reindex.mutateAsync(undefined);
      toast.success(`Reindexação concluída: ${result?.embedded || 0} chunks gerados, ${result?.errors || 0} erros`);
      refetchStats();
    } catch (error) {
      toast.error("Erro na reindexação. Verifique os logs.");
    } finally {
      setIsReindexing(false);
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
            <CardTitle className="text-lg">RAG — Busca Semântica</CardTitle>
          </div>
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
            {isReindexing ? "Reindexando..." : "Reindexar Tudo"}
          </Button>
        </div>
        <CardDescription>
          A Amélia busca apenas os trechos relevantes para cada pergunta do lead, economizando tokens e melhorando precisão.
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
                  {totalEmbeddings} chunks indexados
                </span>
              ) : (
                <span className="text-amber-600">Não indexado</span>
              )}
            </span>
          </div>
          <Progress value={coveragePercent} className="h-2" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
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
        </div>

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
            ⚠️ Nenhum embedding gerado ainda. Clique em "Reindexar Tudo" para ativar a busca semântica.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
