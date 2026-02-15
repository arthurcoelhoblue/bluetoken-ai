import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendEmailSchema, type SendEmailFormData } from '@/schemas/email';
import { useAnalyticsEvents } from '@/hooks/useAnalyticsEvents';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  contactEmail: string | null;
  contactNome: string | null;
  dealTitulo?: string;
  onSent?: () => void;
}

export function EmailFromDealDialog({ open, onOpenChange, dealId, contactEmail, contactNome, dealTitulo, onSent }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { trackFeatureUse } = useAnalyticsEvents();
  const form = useForm<SendEmailFormData>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: { to: contactEmail || '', subject: '', body: '' },
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      form.reset({ to: contactEmail || '', subject: '', body: '' });
    }
    onOpenChange(isOpen);
  };

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('copilot-chat', {
        body: {
          messages: [{ role: 'user', content: `Gere um rascunho de email profissional para ${contactNome || 'o contato'} sobre o deal "${dealTitulo || 'em andamento'}". O email deve ser cordial, objetivo e incluir um call-to-action claro. Retorne APENAS o JSON: {"subject": "...", "body": "..."}` }],
          contextType: 'DEAL',
          contextId: dealId,
          empresa: 'BLUE',
        },
      });

      if (error) throw error;

      try {
        const content = data?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          form.setValue('subject', parsed.subject || '');
          form.setValue('body', parsed.body || '');
          toast.success('Rascunho gerado pela Amélia');
        } else {
          form.setValue('body', content);
          toast.success('Conteúdo gerado — ajuste o assunto');
        }
      } catch {
        form.setValue('body', data?.content || '');
        toast.success('Conteúdo gerado — ajuste o assunto');
      }
    } catch (e) {
      toast.error('Não foi possível gerar o rascunho');
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (data: SendEmailFormData) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('email-send', {
        body: {
          to: data.to.trim(),
          subject: data.subject.trim(),
          html: `<div style="font-family:sans-serif;white-space:pre-wrap;">${data.body}</div>`,
        },
      });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Falha ao enviar');

      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        tipo: 'EMAIL',
        descricao: `Email para ${data.to}: ${data.subject}`,
      });

      toast.success('Email enviado com sucesso');
      onOpenChange(false);
      onSent?.();
      trackFeatureUse('email_from_deal', { dealId });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar email';
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Enviar Email
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateDraft}
              disabled={isGenerating}
              className="ml-auto"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Amélia escreve
            </Button>
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSend)} className="space-y-4">
            <FormField control={form.control} name="to" render={({ field }) => (
              <FormItem>
                <FormLabel>Destinatário</FormLabel>
                <FormControl><Input {...field} placeholder="email@exemplo.com" type="email" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem>
                <FormLabel>Assunto</FormLabel>
                <FormControl><Input {...field} placeholder="Assunto do email" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="body" render={({ field }) => (
              <FormItem>
                <FormLabel>Mensagem</FormLabel>
                <FormControl><Textarea {...field} placeholder="Escreva sua mensagem ou clique em 'Amélia escreve'..." rows={6} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Enviar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
