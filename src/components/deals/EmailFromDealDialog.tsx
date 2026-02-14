import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  contactEmail: string | null;
  contactNome: string | null;
  onSent?: () => void;
}

export function EmailFromDealDialog({ open, onOpenChange, dealId, contactEmail, contactNome, onSent }: Props) {
  const [to, setTo] = useState(contactEmail || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTo(contactEmail || '');
      setSubject('');
      setBody('');
    }
    onOpenChange(isOpen);
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-send', {
        body: {
          to: to.trim(),
          subject: subject.trim(),
          html: `<div style="font-family:sans-serif;white-space:pre-wrap;">${body}</div>`,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar');

      // Register activity
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        tipo: 'EMAIL',
        descricao: `Email para ${to}: ${subject}`,
      });

      toast.success('Email enviado com sucesso');
      onOpenChange(false);
      onSent?.();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Enviar Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Destinatário</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@exemplo.com" type="email" />
          </div>
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto do email" />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Escreva sua mensagem..." rows={6} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
