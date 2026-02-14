import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { AlertTriangle, Check, Bot, User, Shield, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useLossPendencies, useResolveLoss, type LossPendency } from '@/hooks/useLossPendencies';
import { useLossCategories } from '@/hooks/useDeals';
import { useFaqPendencies, useResolveFaq } from '@/hooks/useKnowledgeFaq';
import type { KnowledgeFaq } from '@/types/knowledge';

// --- Loss Pendency Card (existing) ---
function PendencyCard({ pendency }: { pendency: LossPendency }) {
  const resolveLoss = useResolveLoss();
  const { data: categories = [] } = useLossCategories();
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);
  const [otherMotivo, setOtherMotivo] = useState('');
  const [otherCategoria, setOtherCategoria] = useState('');

  const getCategoryLabel = (code: string | null) => {
    if (!code) return '—';
    const cat = categories.find(c => c.codigo === code);
    return cat?.label ?? code;
  };

  const handleAcceptCloser = () => {
    resolveLoss.mutate({ dealId: pendency.id, motivo_perda_final: pendency.motivo_perda_closer ?? '', categoria_perda_final: pendency.categoria_perda_closer ?? '' },
      { onSuccess: () => toast.success('Resolvido com motivo do Closer') });
  };

  const handleAcceptIA = () => {
    resolveLoss.mutate({ dealId: pendency.id, motivo_perda_final: pendency.motivo_perda_ia ?? '', categoria_perda_final: pendency.categoria_perda_ia ?? '' },
      { onSuccess: () => toast.success('Resolvido com motivo da IA') });
  };

  const handleOtherSubmit = () => {
    if (!otherMotivo.trim() || !otherCategoria) { toast.error('Informe categoria e motivo'); return; }
    resolveLoss.mutate({ dealId: pendency.id, motivo_perda_final: otherMotivo.trim(), categoria_perda_final: otherCategoria },
      { onSuccess: () => { toast.success('Resolvido com motivo do gestor'); setOtherDialogOpen(false); } });
  };

  return (
    <>
      <Card className="border-warning/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{pendency.titulo}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {pendency.contacts?.nome ?? 'Sem contato'} • Fechado em {pendency.fechado_em ? new Date(pendency.fechado_em).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30"><AlertTriangle className="h-3 w-3 mr-1" />Divergência</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><User className="h-4 w-4 text-primary" />Closer</div>
              <Badge variant="secondary">{getCategoryLabel(pendency.categoria_perda_closer)}</Badge>
              <p className="text-sm text-muted-foreground">{pendency.motivo_perda_closer || '—'}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4 text-primary" />IA</div>
              <Badge variant="secondary">{getCategoryLabel(pendency.categoria_perda_ia)}</Badge>
              <p className="text-sm text-muted-foreground">{pendency.motivo_perda_ia || '—'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={handleAcceptCloser} disabled={resolveLoss.isPending}><User className="h-3.5 w-3.5 mr-1" />Aceitar Closer</Button>
            <Button size="sm" variant="outline" onClick={handleAcceptIA} disabled={resolveLoss.isPending}><Bot className="h-3.5 w-3.5 mr-1" />Aceitar IA</Button>
            <Button size="sm" onClick={() => setOtherDialogOpen(true)} disabled={resolveLoss.isPending}><Shield className="h-3.5 w-3.5 mr-1" />Informar Outro</Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={otherDialogOpen} onOpenChange={setOtherDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo do Gestor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={otherCategoria} onValueChange={setOtherCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.codigo} value={c.codigo}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={otherMotivo} onChange={e => setOtherMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo real..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtherDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleOtherSubmit} disabled={resolveLoss.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- FAQ Pendency Card ---
function FaqPendencyCard({ faq }: { faq: KnowledgeFaq }) {
  const resolveFaq = useResolveFaq();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState('');

  const handleApprove = () => {
    resolveFaq.mutate({ id: faq.id, action: 'APROVADO' },
      { onSuccess: () => toast.success('FAQ aprovada e publicada') });
  };

  const handleReject = () => {
    if (!rejectMotivo.trim()) { toast.error('Informe o motivo da rejeição'); return; }
    resolveFaq.mutate({ id: faq.id, action: 'REJEITADO', motivo_rejeicao: rejectMotivo.trim() },
      { onSuccess: () => { toast.success('FAQ rejeitada'); setRejectOpen(false); } });
  };

  return (
    <>
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{faq.pergunta}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Por {(faq.autor as { nome: string } | null)?.nome ?? 'Desconhecido'} • {new Date(faq.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <HelpCircle className="h-3 w-3 mr-1" />FAQ
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-sm whitespace-pre-wrap">{faq.resposta}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {faq.categoria && <Badge variant="secondary">{faq.categoria}</Badge>}
            {faq.tags?.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" onClick={handleApprove} disabled={resolveFaq.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={resolveFaq.isPending}>
              Rejeitar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar FAQ</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da rejeição</Label>
            <Textarea value={rejectMotivo} onChange={e => setRejectMotivo(e.target.value)} rows={3} placeholder="Explique por que esta FAQ não deve ser publicada..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={resolveFaq.isPending}>Confirmar Rejeição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Main Page ---
export default function PendenciasPerda() {
  const { data: lossPendencies = [], isLoading: loadingLoss } = useLossPendencies();
  const { data: faqPendencies = [], isLoading: loadingFaq } = useFaqPendencies();

  const isLoading = loadingLoss || loadingFaq;
  const totalPendencies = lossPendencies.length + faqPendencies.length;

  return (
    <AppLayout>
      <PageShell
        icon={AlertTriangle}
        title="Pendências do Gestor"
        description="Resolva divergências e tome decisões sobre situações pendentes."
      />
      <div className="px-6 pb-8 space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : totalPendencies === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Check className="h-8 w-8 text-success mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma pendência no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {faqPendencies.map(faq => <FaqPendencyCard key={faq.id} faq={faq} />)}
            {lossPendencies.map(p => <PendencyCard key={p.id} pendency={p} />)}
          </>
        )}
      </div>
    </AppLayout>
  );
}
