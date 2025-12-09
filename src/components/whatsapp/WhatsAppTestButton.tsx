import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { EmpresaTipo } from '@/types/sgt';

interface WhatsAppTestButtonProps {
  leadId: string;
  empresa: EmpresaTipo;
  telefone: string | null;
  nome?: string | null;
}

export function WhatsAppTestButton({ leadId, empresa, telefone, nome }: WhatsAppTestButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string; testMode?: boolean } | null>(null);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: 'Mensagem vazia',
        description: 'Digite uma mensagem para enviar.',
        variant: 'destructive',
      });
      return;
    }

    if (!telefone) {
      toast({
        title: 'Telefone não encontrado',
        description: 'Este lead não possui telefone cadastrado.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          leadId,
          telefone,
          mensagem: message,
          empresa,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult(data);

      if (data.success) {
        toast({
          title: 'Mensagem enviada!',
          description: data.testMode 
            ? 'Modo teste: mensagem enviada para número de teste.' 
            : 'Mensagem enviada com sucesso.',
        });
      } else {
        toast({
          title: 'Erro no envio',
          description: data.error || 'Falha ao enviar mensagem.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setResult({ success: false, error: errorMessage });
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setMessage('');
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!telefone}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Testar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Testar Envio WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem de teste para este lead via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lead Info */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <div className="flex-1">
              <p className="font-medium text-sm">{nome || leadId}</p>
              <p className="text-xs text-muted-foreground">{telefone}</p>
            </div>
            <Badge variant="outline">{empresa}</Badge>
          </div>

          {/* Test Mode Warning */}
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-warning">Modo Teste Ativo</p>
              <p className="text-muted-foreground">
                A mensagem será enviada para o número de teste, não para o lead real.
              </p>
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem de teste..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>

          {/* Result */}
          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg ${
              result.success 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-destructive/10 border border-destructive/20'
            }`}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              )}
              <div className="text-xs">
                <p className={`font-medium ${result.success ? 'text-green-600' : 'text-destructive'}`}>
                  {result.success ? 'Enviado com sucesso!' : 'Erro no envio'}
                </p>
                <p className="text-muted-foreground">
                  {result.success 
                    ? (result.testMode ? 'Mensagem enviada para número de teste.' : 'Mensagem entregue.')
                    : result.error
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Fechar
          </Button>
          <Button onClick={handleSend} disabled={isLoading || !message.trim()}>
            {isLoading ? (
              <>Enviando...</>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Teste
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
