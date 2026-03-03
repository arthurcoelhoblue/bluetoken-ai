import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CallSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId?: string;
  contactName: string;
  phoneNumber: string;
  callDuration: number;
}

export function CallSummaryDialog({
  open,
  onOpenChange,
  dealId,
  contactName,
  phoneNumber,
  callDuration,
}: CallSummaryDialogProps) {
  const { user } = useAuth();
  const [resultado, setResultado] = useState<string>('ATENDEU');
  const [resumo, setResumo] = useState('');
  const [proximoPasso, setProximoPasso] = useState('');
  const [saving, setSaving] = useState(false);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}s`;
  };

  const handleSave = async () => {
    if (!resumo.trim()) {
      toast.error('Preencha o resumo da ligação.');
      return;
    }

    setSaving(true);
    try {
      const noteContent = [
        `**Ligação** — ${contactName || phoneNumber}`,
        `**Resultado:** ${resultado}`,
        `**Duração:** ${formatDuration(callDuration)}`,
        `**Resumo:** ${resumo.trim()}`,
        proximoPasso.trim() ? `**Próximo passo:** ${proximoPasso.trim()}` : '',
      ].filter(Boolean).join('\n');

      if (dealId) {
        await supabase.from('deal_notes' as any).insert({
          deal_id: dealId,
          conteudo: noteContent,
          created_by: user?.id,
        });

        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          tipo: 'LIGACAO',
          descricao: `Ligação ${resultado.toLowerCase()} com ${contactName || phoneNumber} (${formatDuration(callDuration)})`,
          metadata: {
            resultado,
            duracao_segundos: callDuration,
            telefone: phoneNumber,
            resumo: resumo.trim(),
            proximo_passo: proximoPasso.trim() || null,
          },
        });

        toast.success('Resumo da ligação salvo no deal!');
      } else {
        toast.info('Resumo registrado. Nenhum deal vinculado para salvar a nota.');
      }

      setResultado('ATENDEU');
      setResumo('');
      setProximoPasso('');
      onOpenChange(false);
    } catch (err) {
      console.error('Erro ao salvar resumo:', err);
      toast.error('Erro ao salvar resumo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setResultado('ATENDEU');
    setResumo('');
    setProximoPasso('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Resumo da Ligação
          </DialogTitle>
          <DialogDescription>
            Registre o resultado da ligação com {contactName || phoneNumber} ({formatDuration(callDuration)}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ATENDEU">Atendeu</SelectItem>
                <SelectItem value="NAO_ATENDEU">Não atendeu</SelectItem>
                <SelectItem value="CAIXA_POSTAL">Caixa postal</SelectItem>
                <SelectItem value="NUMERO_ERRADO">Número errado</SelectItem>
                <SelectItem value="OCUPADO">Ocupado</SelectItem>
                <SelectItem value="RETORNAR">Pediu para retornar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Resumo da conversa *</Label>
            <Textarea
              placeholder="O que foi discutido? Qual o interesse do lead? Objeções levantadas?"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Próximo passo</Label>
            <Textarea
              placeholder="Ex: Enviar proposta por email, agendar reunião, ligar novamente em 2 dias..."
              value={proximoPasso}
              onChange={(e) => setProximoPasso(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
            Pular
          </Button>
          <Button onClick={handleSave} disabled={saving || !resumo.trim()} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Resumo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
