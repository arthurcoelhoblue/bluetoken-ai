import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAICostDashboard } from "@/hooks/useAICostDashboard";
import { useAdoptionMetrics } from "@/hooks/useAdoptionMetrics";
import { useState } from "react";
import { DollarSign, Zap, Brain, Clock, AlertTriangle, TrendingUp, Users, BarChart3 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AICostDashboardPage() {
  const [days, setDays] = useState(30);
  const { data: costs, isLoading } = useAICostDashboard(days);
  const { data: adoption, isLoading: adoptionLoading } = useAdoptionMetrics(days);

  return (
    <AppLayout>
      <div className="container max-w-7xl space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inteligência Operacional</h1>
            <p className="text-muted-foreground">Custos IA, adoção de features e telemetria do sistema</p>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="custos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="custos" className="gap-2">
              <DollarSign className="h-4 w-4" /> Custos IA
            </TabsTrigger>
            <TabsTrigger value="adocao" className="gap-2">
              <Users className="h-4 w-4" /> Adoção
            </TabsTrigger>
          </TabsList>

          <TabsContent value="custos">
            {isLoading ? (
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : costs ? (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" />Custo Total</div>
                      <p className="text-2xl font-bold">${costs.totalCost.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Zap className="h-4 w-4" />Chamadas</div>
                      <p className="text-2xl font-bold">{costs.totalCalls.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Brain className="h-4 w-4" />Tokens</div>
                      <p className="text-2xl font-bold">{(costs.totalTokens / 1000).toFixed(0)}K</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="h-4 w-4" />Latência Média</div>
                      <p className="text-2xl font-bold">{costs.avgLatency}ms</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="h-4 w-4" />Taxa Erro</div>
                      <p className="text-2xl font-bold">{costs.errorRate.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Trend Chart */}
                {costs.dailyTrend.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Tendência Diária</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={{ cost: { label: "Custo ($)", color: "hsl(var(--primary))" }, calls: { label: "Chamadas", color: "hsl(var(--accent))" } }} className="h-64">
                        <LineChart data={costs.dailyTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line yAxisId="left" type="monotone" dataKey="total_cost" stroke="var(--color-cost)" name="Custo ($)" strokeWidth={2} />
                          <Line yAxisId="right" type="monotone" dataKey="total_calls" stroke="var(--color-calls)" name="Chamadas" strokeWidth={2} />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Breakdown Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Breakdown por Function</CardTitle>
                    <CardDescription>Custo, tokens e performance por edge function + provedor</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Function</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Erros</TableHead>
                          <TableHead className="text-right">Tokens</TableHead>
                          <TableHead className="text-right">Latência</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costs.byFunction.map((fn, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{fn.function_name}</TableCell>
                            <TableCell><Badge variant="outline">{fn.provider}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fn.model}</TableCell>
                            <TableCell className="text-right">{fn.total_calls}</TableCell>
                            <TableCell className="text-right">{fn.failed_calls > 0 ? <span className="text-destructive">{fn.failed_calls}</span> : "0"}</TableCell>
                            <TableCell className="text-right">{((fn.total_tokens_input + fn.total_tokens_output) / 1000).toFixed(1)}K</TableCell>
                            <TableCell className="text-right">{Math.round(fn.avg_latency_ms)}ms</TableCell>
                            <TableCell className="text-right font-medium">${fn.total_cost_usd.toFixed(3)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-muted-foreground">Sem dados disponíveis</p>
            )}
          </TabsContent>

          <TabsContent value="adocao">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Métricas de Adoção</CardTitle>
                <CardDescription>Features mais usadas nos últimos {days} dias</CardDescription>
              </CardHeader>
              <CardContent>
                {adoptionLoading ? (
                  <Skeleton className="h-64" />
                ) : adoption && adoption.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature / Evento</TableHead>
                        <TableHead className="text-right">Usuários Únicos</TableHead>
                        <TableHead className="text-right">Total Eventos</TableHead>
                        <TableHead className="text-right">Último Uso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adoption.slice(0, 30).map((m, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{m.feature}</TableCell>
                          <TableCell className="text-right">{m.unique_users}</TableCell>
                          <TableCell className="text-right">{m.total_events}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">
                            {new Date(m.last_used).toLocaleDateString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum evento registrado ainda. O tracking começa automaticamente na navegação.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
