import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { useCSSurveys } from '@/hooks/useCSSurveys';
import { useCSCustomers } from '@/hooks/useCSCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ClipboardList, Send, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CSTrendingTopicsCard } from '@/components/cs/CSTrendingTopicsCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CSPesquisasPage() {
  const navigate = useNavigate();
  const { data: surveys } = useCSSurveys();
  const { data: customersData } = useCSCustomers({ is_active: true }, 0);
  const customers = customersData?.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<'NPS' | 'CSAT'>('NPS');
  const [sending, setSending] = useState(false);

  const pendentes = surveys?.filter(s => s.respondido_em == null) ?? [];
  const respondidas = surveys?.filter(s => s.respondido_em != null) ?? [];

  const handleSendSurvey = async () => {
    if (!selectedCustomerId) {
      toast.error('Selecione um cliente');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('cs-scheduled-jobs', {
        body: { action: 'nps-auto', customer_id: selectedCustomerId, tipo: selectedTipo },
      });
      if (error) throw error;
      toast.success(`Pesquisa ${selectedTipo} enviada com sucesso!`);
      setDialogOpen(false);
      setSelectedCustomerId('');
    } catch (_err) {
      toast.error('Erro ao enviar pesquisa');
    } finally {
      setSending(false);
    }
  };

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
                <TableCell className="font-medium text-sm">{s.customer?.contact?.nome || '—'}</TableCell>
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
    <AppLayout>
    <div className="flex-1 overflow-auto">
      <PageShell icon={ClipboardList} title="Pesquisas CS" description="NPS, CSAT e CES dos clientes">
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/cs/pesquisas/massa')} variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Envio em Massa
          </Button>
          <Button onClick={() => setDialogOpen(true)} size="sm">
          <Send className="h-4 w-4 mr-2" />
          Enviar Pesquisa
        </Button>
        </div>
      </PageShell>
      <div className="px-6 pb-6">
        <Tabs defaultValue="pendentes">
          <TabsList>
            <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
            <TabsTrigger value="respondidas">Respondidas ({respondidas.length})</TabsTrigger>
            <TabsTrigger value="analise">Análise IA</TabsTrigger>
          </TabsList>
          <TabsContent value="pendentes" className="mt-4">{renderTable(pendentes)}</TabsContent>
          <TabsContent value="respondidas" className="mt-4">{renderTable(respondidas)}</TabsContent>
          <TabsContent value="analise" className="mt-4">
            <CSTrendingTopicsCard />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Pesquisa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contact?.nome || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={selectedTipo} onValueChange={(v) => setSelectedTipo(v as 'NPS' | 'CSAT')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NPS">NPS</SelectItem>
                  <SelectItem value="CSAT">CSAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendSurvey} disabled={sending}>
              {sending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
