import { PageShell } from '@/components/layout/PageShell';
import { useCSIncidents } from '@/hooks/useCSIncidents';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle } from 'lucide-react';
import { gravidadeConfig, incidentStatusConfig, type CSIncidentStatus } from '@/types/customerSuccess';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

export default function CSIncidenciasPage() {
  const [statusFilter, setStatusFilter] = useState<CSIncidentStatus | undefined>(undefined);
  const { data: incidents, isLoading } = useCSIncidents(undefined, statusFilter);

  return (
    <div className="flex-1 overflow-auto">
      <PageShell icon={AlertCircle} title="Incidências CS" description="Ocorrências na jornada dos clientes" />
      <div className="px-6 pb-6 space-y-4">
        <div className="flex items-center gap-3">
          <Select value={statusFilter || 'ALL'} onValueChange={v => setStatusFilter(v === 'ALL' ? undefined : v as CSIncidentStatus)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="ABERTA">Aberta</SelectItem>
              <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
              <SelectItem value="RESOLVIDA">Resolvida</SelectItem>
              <SelectItem value="FECHADA">Fechada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Gravidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6">Carregando...</TableCell></TableRow>
                ) : incidents?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma incidência</TableCell></TableRow>
                ) : incidents?.map(inc => (
                  <TableRow key={inc.id}>
                    <TableCell className="font-medium text-sm">{(inc.customer as any)?.contact?.nome || '—'}</TableCell>
                    <TableCell className="text-sm">{inc.titulo}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{inc.tipo.toLowerCase().replace('_', ' ')}</Badge></TableCell>
                    <TableCell><Badge className={gravidadeConfig[inc.gravidade]?.bgClass}>{gravidadeConfig[inc.gravidade]?.label}</Badge></TableCell>
                    <TableCell><Badge className={incidentStatusConfig[inc.status]?.bgClass}>{incidentStatusConfig[inc.status]?.label}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(inc.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
