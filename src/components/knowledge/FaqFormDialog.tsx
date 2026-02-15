import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { X, Loader2 } from 'lucide-react';
import { FAQ_CATEGORIAS } from '@/types/knowledge';
import { useCreateFaq, checkFaqAutoApproval } from '@/hooks/useKnowledgeFaq';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { faqCreateSchema, type FaqCreateFormData } from '@/schemas/knowledge';
import { supabase } from '@/integrations/supabase/client';

interface FaqFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaqFormDialog({ open, onOpenChange }: FaqFormDialogProps) {
  const [tagInput, setTagInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const createFaq = useCreateFaq();
  const { activeCompany } = useCompany();
  const { user } = useAuth();

  const form = useForm<FaqCreateFormData>({
    resolver: zodResolver(faqCreateSchema),
    defaultValues: { pergunta: '', resposta: '', categoria: 'Outros', tags: [] },
  });

  const tags = form.watch('tags') ?? [];

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      form.setValue('tags', [...tags, t]);
      setTagInput('');
    }
  };

  const handleSubmit = async (mode: 'RASCUNHO' | 'PUBLICAR') => {
    const valid = await form.trigger();
    if (!valid) return;

    const data = form.getValues();
    const empresa = activeCompany === 'ALL' ? 'BLUE' : activeCompany;

    if (mode === 'RASCUNHO') {
      createFaq.mutate({
        pergunta: data.pergunta.trim(),
        resposta: data.resposta.trim(),
        categoria: data.categoria,
        tags: data.tags,
        status: 'RASCUNHO',
        empresa,
      }, {
        onSuccess: () => {
          toast.success('Rascunho salvo');
          form.reset();
          setTagInput('');
          onOpenChange(false);
        },
        onError: () => toast.error('Erro ao salvar'),
      });
      return;
    }

    // Mode = PUBLICAR: check admin first, then AI
    setIsAnalyzing(true);
    try {
      // Check if user is ADMIN
      const userId = user?.id ?? '';
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      const isAdmin = roles?.some(r => r.role === 'ADMIN') ?? false;

      let finalStatus: 'APROVADO' | 'PENDENTE' = 'PENDENTE';
      let toastMsg = 'Enviado para aprovação do gestor';

      if (isAdmin) {
        finalStatus = 'APROVADO';
        toastMsg = 'FAQ aprovada automaticamente (admin)';
      } else {
        // Call AI auto-review
        const review = await checkFaqAutoApproval(
          data.pergunta.trim(),
          data.resposta.trim(),
          empresa
        );

        if (review.auto_approve) {
          finalStatus = 'APROVADO';
          toastMsg = `FAQ aprovada automaticamente — ${review.justificativa}`;
        }
      }

      createFaq.mutate({
        pergunta: data.pergunta.trim(),
        resposta: data.resposta.trim(),
        categoria: data.categoria,
        tags: data.tags,
        status: finalStatus,
        visivel_amelia: finalStatus === 'APROVADO',
        empresa,
      }, {
        onSuccess: () => {
          toast.success(toastMsg);
          form.reset();
          setTagInput('');
          onOpenChange(false);
        },
        onError: () => toast.error('Erro ao salvar'),
      });
    } catch {
      // Fallback: send as PENDENTE
      createFaq.mutate({
        pergunta: data.pergunta.trim(),
        resposta: data.resposta.trim(),
        categoria: data.categoria,
        tags: data.tags,
        status: 'PENDENTE',
        empresa,
      }, {
        onSuccess: () => {
          toast.success('Enviado para aprovação do gestor');
          form.reset();
          setTagInput('');
          onOpenChange(false);
        },
        onError: () => toast.error('Erro ao salvar'),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isBusy = createFaq.isPending || isAnalyzing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova FAQ</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <div className="space-y-4">
            <FormField control={form.control} name="pergunta" render={({ field }) => (
              <FormItem>
                <FormLabel>Pergunta *</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Como funciona o rendimento?" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="resposta" render={({ field }) => (
              <FormItem>
                <FormLabel>Resposta *</FormLabel>
                <FormControl><Textarea {...field} rows={5} placeholder="Resposta completa (suporta Markdown)" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="categoria" render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {FAQ_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <div className="space-y-2">
              <FormLabel>Tags</FormLabel>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Adicionar tag"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>+</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {tags.map(t => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => form.setValue('tags', tags.filter(x => x !== t))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleSubmit('RASCUNHO')} disabled={isBusy}>
              Salvar Rascunho
            </Button>
            <Button onClick={() => handleSubmit('PUBLICAR')} disabled={isBusy}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                'Publicar para Aprovação'
              )}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
