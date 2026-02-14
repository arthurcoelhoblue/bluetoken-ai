import { PageShell } from '@/components/layout/PageShell';
import { useCSSurveys } from '@/hooks/useCSSurveys';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CSPesquisasPage() {
  const { data: surveys } = useCSSurveys();
  const pendentes = surveys?.filter(s => s.respondido_em == null) ?? [];
  const respondidas = surveys?.filter(s => s.respondido_em != null) ?? [];

  const renderTable = (items: typeof surveys) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead>Respondido em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma pesquisa</TableCell></TableRow>
            ) : items?.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-sm">{(s.customer as any)?.contact?.nome || '—'}</TableCell>
                <TableCell><Badge variant="outline">{s.tipo}</Badge></TableCell>
                <TableCell>{s.nota != null ? <span className="font-bold">{s.nota}</span> : '—'}</TableCell>
                <TableCell className="text-xs">{format(new Date(s.enviado_em), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                <TableCell className="text-xs">{s.respondido_em ? format(new Date(s.respondido_em), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex-1 overflow-auto">
      <PageShell icon={ClipboardList} title="Pesquisas CS" description="NPS, CSAT e CES dos clientes" />
      <div className="px-6 pb-6">
        <Tabs defaultValue="pendentes">
          <TabsList>
            <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
            <TabsTrigger value="respondidas">Respondidas ({respondidas.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pendentes" className="mt-4">{renderTable(pendentes)}</TabsContent>
          <TabsContent value="respondidas" className="mt-4">{renderTable(respondidas)}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
