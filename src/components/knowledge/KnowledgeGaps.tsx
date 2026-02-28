import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle, Eye, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeGap {
  id: string;
  empresa: string;
  topic: string;
  description: string | null;
  frequency: number;
  sample_queries: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export function KnowledgeGaps({ empresa }: { empresa: string }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: gaps, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-gaps", empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_gaps")
        .select("*")
        .eq("empresa", empresa)
        .order("frequency", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as KnowledgeGap[];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (gapId: string) => {
      const { error } = await supabase
        .from("knowledge_gaps")
        .update({ status: "RESOLVIDO", resolved_at: new Date().toISOString() })
        .eq("id", gapId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-gaps"] });
      toast.success("Lacuna marcada como resolvida");
    },
  });

  const openGaps = gaps?.filter(g => g.status === "ABERTO") || [];
  const resolvedGaps = gaps?.filter(g => g.status === "RESOLVIDO") || [];
  const totalQueries = openGaps.reduce((sum, g) => sum + g.frequency, 0);

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando lacunas...</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            O que a Amélia não sabe responder
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {openGaps.length} abertas
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> {resolvedGaps.length} resolvidas
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> {totalQueries} perguntas sem resposta
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {openGaps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            🎉 Nenhuma lacuna detectada! A base de conhecimento está cobrindo todas as perguntas.
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {openGaps.map(gap => (
                <div
                  key={gap.id}
                  className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{gap.topic}</p>
                      {gap.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{gap.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {gap.frequency}x
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setExpandedId(expandedId === gap.id ? null : gap.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-green-600"
                        onClick={() => resolveMutation.mutate(gap.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {expandedId === gap.id && gap.sample_queries.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Exemplos de perguntas:</p>
                      <ul className="space-y-1">
                        {gap.sample_queries.slice(0, 5).map((q, i) => (
                          <li key={i} className="text-xs text-muted-foreground pl-2 border-l-2 border-muted">
                            "{q}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
