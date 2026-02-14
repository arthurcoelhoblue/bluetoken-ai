import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { FAQ_CATEGORIAS } from '@/types/knowledge';
import { useCreateFaq } from '@/hooks/useKnowledgeFaq';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface FaqFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaqFormDialog({ open, onOpenChange }: FaqFormDialogProps) {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [categoria, setCategoria] = useState('Outros');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const createFaq = useCreateFaq();
  const { activeCompany } = useCompany();

  const reset = () => {
    setPergunta('');
    setResposta('');
    setCategoria('Outros');
    setTags([]);
    setTagInput('');
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const handleSubmit = (status: 'RASCUNHO' | 'PENDENTE') => {
    if (!pergunta.trim() || !resposta.trim()) {
      toast.error('Pergunta e resposta são obrigatórios');
      return;
    }
    createFaq.mutate({
      pergunta: pergunta.trim(),
      resposta: resposta.trim(),
      categoria,
      tags,
      status,
      empresa: activeCompany === 'ALL' ? 'BLUE' : activeCompany,
    }, {
      onSuccess: () => {
        toast.success(status === 'PENDENTE' ? 'Enviado para aprovação' : 'Rascunho salvo');
        reset();
        onOpenChange(false);
      },
      onError: () => toast.error('Erro ao salvar'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova FAQ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pergunta *</Label>
            <Input value={pergunta} onChange={e => setPergunta(e.target.value)} placeholder="Ex: Como funciona o rendimento?" />
          </div>
          <div className="space-y-2">
            <Label>Resposta *</Label>
            <Textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={5} placeholder="Resposta completa (suporta Markdown)" />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FAQ_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
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
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter(x => x !== t))} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleSubmit('RASCUNHO')} disabled={createFaq.isPending}>
            Salvar Rascunho
          </Button>
          <Button onClick={() => handleSubmit('PENDENTE')} disabled={createFaq.isPending}>
            Publicar para Aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
