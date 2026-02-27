import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, FileText, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { MessageTemplate } from '@/hooks/useTemplates';

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: string;
  telefone: string;
  leadId?: string;
  contactId?: string;
  onSent?: () => void;
}

export function TemplatePickerDialog({
  open,
  onOpenChange,
  empresa,
  telefone,
  leadId,
  contactId,
  onSent,
}: TemplatePickerDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [variables, setVariables] = useState<Record<number, string>>({});
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['approved-templates', empresa],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates' as any)
        .select('*')
        .eq('empresa', empresa)
        .eq('canal', 'WHATSAPP')
        .eq('meta_status', 'APPROVED')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []) as unknown as MessageTemplate[];
    },
  });

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) => t.nome.toLowerCase().includes(q) || t.conteudo.toLowerCase().includes(q)
    );
  }, [templates, search]);

  // Extract {{1}}, {{2}} etc from template content
  const variableSlots = useMemo(() => {
    if (!selectedTemplate) return [];
    const matches = selectedTemplate.conteudo.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const unique = [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ''))))];
    return unique.sort((a, b) => a - b);
  }, [selectedTemplate]);

  const previewContent = useMemo(() => {
    if (!selectedTemplate) return '';
    let text = selectedTemplate.conteudo;
    variableSlots.forEach((slot) => {
      const val = variables[slot] || `{{${slot}}}`;
      text = text.replace(new RegExp(`\\{\\{${slot}\\}\\}`, 'g'), val);
    });
    return text;
  }, [selectedTemplate, variables, variableSlots]);

  const allVariablesFilled = variableSlots.every((slot) => variables[slot]?.trim());

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error('Nenhum template selecionado');

      const bodyParams = variableSlots.length > 0
        ? variableSlots.map((slot) => ({ type: 'text' as const, text: variables[slot] }))
        : [];

      const metaComponents = bodyParams.length
        ? [{ type: 'body' as const, parameters: bodyParams }]
        : [];

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          ...(leadId ? { leadId } : {}),
          ...(contactId ? { contactId } : {}),
          telefone,
          mensagem: previewContent,
          empresa,
          metaTemplateName: selectedTemplate.codigo,
          metaLanguage: selectedTemplate.meta_language || 'pt_BR',
          metaComponents,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Falha ao enviar template');
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Template enviado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages'] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      setSelectedTemplate(null);
      setVariables({});
      onOpenChange(false);
      onSent?.();
    },
    onError: (e: Error) => {
      toast({ title: 'Erro ao enviar template', description: e.message, variant: 'destructive' });
    },
  });

  const handleSelect = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setVariables({});
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setVariables({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {selectedTemplate ? 'Configurar Template' : 'Selecionar Template'}
          </DialogTitle>
          <DialogDescription>
            {selectedTemplate
              ? 'Preencha as variáveis e envie o template aprovado.'
              : 'Escolha um template aprovado pela Meta para enviar.'}
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Carregando...</p>
              ) : filteredTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  Nenhum template aprovado encontrado.
                </p>
              ) : (
                <div className="space-y-2 pr-3">
                  {filteredTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelect(t)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{t.nome}</span>
                        <Badge variant="secondary" className="text-xs">
                          {t.meta_category || 'UTILITY'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.conteudo}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Preview</p>
              <p className="text-sm whitespace-pre-wrap">{previewContent}</p>
            </div>

            {variableSlots.length > 0 && (
              <div className="space-y-3">
                {variableSlots.map((slot) => (
                  <div key={slot} className="space-y-1">
                    <Label className="text-xs">Variável {`{{${slot}}}`}</Label>
                    <Input
                      placeholder={`Valor para {{${slot}}}`}
                      value={variables[slot] || ''}
                      onChange={(e) =>
                        setVariables((prev) => ({ ...prev, [slot]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={
                  sendMutation.isPending || (variableSlots.length > 0 && !allVariablesFilled)
                }
              >
                <Send className="h-4 w-4 mr-2" />
                {sendMutation.isPending ? 'Enviando...' : 'Enviar Template'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
