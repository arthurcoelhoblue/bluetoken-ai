import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Eye, TrendingUp, RefreshCw, MessageSquarePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useCreateFaq } from "@/hooks/useKnowledgeFaq";
import { FAQ_CATEGORIAS } from "@/types/knowledge";

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

export function KnowledgeGaps({ empresas }: { empresas: string[] }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [teachingGapId, setTeachingGapId] = useState<string | null>(null);
  const [teachForm, setTeachForm] = useState({ pergunta: "", resposta: "", categoria: "Outros" });
  const createFaq = useCreateFaq();

  const { data: gaps, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-gaps", empresas],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_gaps")
        .select("*")
        .in("empresa", empresas)
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

  const teachMutation = useMutation({
    mutationFn: async ({ gap, pergunta, resposta, categoria }: {
      gap: KnowledgeGap;
      pergunta: string;
      resposta: string;
      categoria: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Check if admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some(r => r.role === "ADMIN") ?? false;
      const status = isAdmin ? "APROVADO" : "PENDENTE";

      // Create FAQ
      const faqResult = await createFaq.mutateAsync({
        pergunta,
        resposta,
        categoria,
        tags: [],
        fonte: "MANUAL",
        status,
        empresa: gap.empresa,
      });

      // Mark gap as resolved with linked FAQ
      const { error } = await supabase
        .from("knowledge_gaps")
        .update({
          status: "RESOLVIDO",
          resolved_at: new Date().toISOString(),
          suggested_faq_id: faqResult.id,
        })
        .eq("id", gap.id);
      if (error) throw error;

      return { status };
    },
    onSuccess: ({ status }) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-gaps"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-faq"] });
      setTeachingGapId(null);
      setTeachForm({ pergunta: "", resposta: "", categoria: "Outros" });
      toast.success(
        status === "APROVADO"
          ? "✅ Amélia aprendeu! FAQ aprovada automaticamente."
          : "📝 Resposta enviada para aprovação do gestor."
      );
    },
    onError: () => {
      toast.error("Erro ao ensinar. Tente novamente.");
    },
  });

  const startTeaching = (gap: KnowledgeGap) => {
    setTeachingGapId(gap.id);
    setExpandedId(null);
    setTeachForm({ pergunta: gap.topic, resposta: "", categoria: "Outros" });
  };

  const cancelTeaching = () => {
    setTeachingGapId(null);
    setTeachForm({ pergunta: "", resposta: "", categoria: "Outros" });
  };

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
          <ScrollArea className="max-h-[500px]">
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
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {gap.empresa}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {gap.frequency}x
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Ver exemplos"
                        onClick={() => {
                          setExpandedId(expandedId === gap.id ? null : gap.id);
                          if (teachingGapId === gap.id) cancelTeaching();
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-primary"
                        title="Ensinar a Amélia"
                        onClick={() => startTeaching(gap)}
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-green-600"
                        title="Marcar como resolvida"
                        onClick={() => resolveMutation.mutate(gap.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Sample queries */}
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

                  {/* Teach form */}
                  {teachingGapId === gap.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-primary flex items-center gap-1">
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          Ensinar a Amélia
                        </p>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={cancelTeaching}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {gap.sample_queries.length > 0 && (
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Contexto — perguntas reais dos leads:</p>
                          <ul className="space-y-0.5">
                            {gap.sample_queries.slice(0, 3).map((q, i) => (
                              <li key={i} className="text-xs text-muted-foreground italic">"{q}"</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs">Pergunta</Label>
                        <Input
                          value={teachForm.pergunta}
                          onChange={e => setTeachForm(f => ({ ...f, pergunta: e.target.value }))}
                          placeholder="Pergunta que o lead faz"
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Resposta correta</Label>
                        <Textarea
                          value={teachForm.resposta}
                          onChange={e => setTeachForm(f => ({ ...f, resposta: e.target.value }))}
                          placeholder="Digite a resposta que a Amélia deve dar..."
                          className="min-h-[80px] text-sm"
                          autoFocus
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Categoria</Label>
                        <Select value={teachForm.categoria} onValueChange={v => setTeachForm(f => ({ ...f, categoria: v }))}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FAQ_CATEGORIAS.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        size="sm"
                        className="w-full"
                        disabled={teachForm.pergunta.length < 5 || teachForm.resposta.length < 10 || teachMutation.isPending}
                        onClick={() => teachMutation.mutate({
                          gap,
                          pergunta: teachForm.pergunta,
                          resposta: teachForm.resposta,
                          categoria: teachForm.categoria,
                        })}
                      >
                        {teachMutation.isPending ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Salvando...</>
                        ) : (
                          <><MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Salvar e Ensinar</>
                        )}
                      </Button>
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
