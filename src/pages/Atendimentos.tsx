import { useState } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AtendimentoCard } from '@/components/atendimentos/AtendimentoCard';
import { useAtendimentos } from '@/hooks/useAtendimentos';

export default function Atendimentos() {
  const [empresaFilter, setEmpresaFilter] = useState<'TOKENIZA' | 'BLUE' | null>(null);
  const { data: atendimentos, isLoading, refetch, isFetching } = useAtendimentos({ empresaFilter });

  const aguardando = atendimentos?.filter(a => a.ultima_direcao === 'INBOUND') ?? [];
  const respondidos = atendimentos?.filter(a => a.ultima_direcao === 'OUTBOUND') ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              Atendimentos Blue Chat
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conversas ativas da Amélia no modo atendente passivo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={empresaFilter ?? 'ALL'}
              onValueChange={(v) => setEmpresaFilter(v === 'ALL' ? null : v as 'TOKENIZA' | 'BLUE')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="BLUE">Blue</SelectItem>
                <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de conversas</CardDescription>
              <CardTitle className="text-2xl">{atendimentos?.length ?? '—'}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aguardando resposta</CardDescription>
              <CardTitle className="text-2xl text-amber-600">{aguardando.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Amélia respondeu</CardDescription>
              <CardTitle className="text-2xl text-emerald-600">{respondidos.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : !atendimentos || atendimentos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum atendimento Blue Chat encontrado.</p>
              <p className="text-xs mt-1">Conversas aparecerão aqui quando leads forem recebidos via Blue Chat.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {atendimentos.map(a => (
              <AtendimentoCard key={`${a.lead_id}_${a.empresa}`} atendimento={a} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
