import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCSOfertasSemNome, useUpdateOfertaNome } from '@/hooks/useCSOfertaMapping';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Loader2, Tag } from 'lucide-react';

export default function CSOfertasPage() {
  const { data: ofertas, isLoading } = useCSOfertasSemNome();
  const updateMutation = useUpdateOfertaNome();
  const [names, setNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const handleApply = async (oferta_id: string) => {
    const nome = names[oferta_id]?.trim();
    if (!nome) return;
    await updateMutation.mutateAsync({ oferta_id, nome });
    setSaved((prev) => new Set([...prev, oferta_id]));
  };

  const fmt = (d: string | null) =>
    d ? format(new Date(d), 'dd/MM/yy', { locale: ptBR }) : '—';

  return (
    <AppLayout>
      <div className="container max-w-6xl space-y-6 py-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ofertas Tokeniza sem nome</h1>
          <p className="text-muted-foreground mt-1">
            Liste e nomeie as ofertas que foram importadas apenas com o ID. O nome será aplicado a todos os
            investimentos da oferta de uma só vez.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              {isLoading ? 'Carregando…' : `${ofertas?.length ?? 0} oferta(s) sem nome`}
            </CardTitle>
            <CardDescription>
              Ofertas onde <code>oferta_nome</code> está em branco ou contém apenas o UUID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando ofertas…
              </div>
            ) : ofertas && ofertas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>oferta_id</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Invest.</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="w-64">Nome correto</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ofertas.map((o) => (
                    <TableRow key={o.oferta_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {o.oferta_id.slice(0, 8)}…
                          </code>
                          {saved.has(o.oferta_id) && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-chart-2 border-chart-2/40">
                              <CheckCircle2 className="h-3 w-3" /> Salvo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{o.qtd_clientes}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.qtd_contratos}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        R$ {o.volume_total.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(o.data_min)} – {fmt(o.data_max)}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Ex: Renda Fixa Tokeniza Jan/25"
                          className="h-8 text-sm"
                          value={names[o.oferta_id] ?? ''}
                          onChange={(e) =>
                            setNames((prev) => ({ ...prev, [o.oferta_id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleApply(o.oferta_id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={!names[o.oferta_id]?.trim() || updateMutation.isPending}
                          onClick={() => handleApply(o.oferta_id)}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Aplicar'
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                ✅ Todas as ofertas Tokeniza estão nomeadas corretamente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
