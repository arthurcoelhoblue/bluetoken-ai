import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { MessageTemplate, TemplateInsert, TemplateUpdate } from '@/hooks/useTemplates';

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  codigo: z.string().min(2, 'Código obrigatório').regex(/^[a-z0-9_]+$/, 'Apenas letras minúsculas, números e _'),
  empresa: z.enum(['BLUE', 'TOKENIZA']),
  canal: z.enum(['WHATSAPP', 'EMAIL']),
  conteudo: z.string().min(5, 'Conteúdo obrigatório'),
  descricao: z.string().optional(),
  assunto_template: z.string().optional(),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate | null;
  onSave: (data: TemplateInsert | TemplateUpdate) => void;
  isSaving: boolean;
}

export function TemplateFormDialog({ open, onOpenChange, template, onSave, isSaving }: Props) {
  const isEditing = !!template;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: '',
      codigo: '',
      empresa: 'BLUE',
      canal: 'WHATSAPP',
      conteudo: '',
      descricao: '',
      assunto_template: '',
      ativo: true,
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        nome: template.nome,
        codigo: template.codigo,
        empresa: template.empresa,
        canal: template.canal,
        conteudo: template.conteudo,
        descricao: template.descricao ?? '',
        assunto_template: template.assunto_template ?? '',
        ativo: template.ativo,
      });
    } else {
      form.reset({
        nome: '', codigo: '', empresa: 'BLUE', canal: 'WHATSAPP',
        conteudo: '', descricao: '', assunto_template: '', ativo: true,
      });
    }
  }, [template, open]);

  const canal = form.watch('canal');
  const conteudo = form.watch('conteudo');

  function handleSubmit(values: FormValues) {
    const payload: TemplateInsert | TemplateUpdate = {
      nome: values.nome,
      codigo: values.codigo,
      empresa: values.empresa,
      canal: values.canal,
      conteudo: values.conteudo,
      descricao: values.descricao || null,
      assunto_template: values.canal === 'EMAIL' ? (values.assunto_template || null) : null,
      ativo: values.ativo,
      ...(isEditing ? { id: template!.id } : {}),
    } as TemplateInsert | TemplateUpdate;
    onSave(payload);
  }

  // Highlight placeholders in preview
  function renderPreview(text: string) {
    return text.replace(/\{\{(\w+)\}\}/g, '<mark class="bg-amber-200 dark:bg-amber-800 px-1 rounded text-xs">{{$1}}</mark>');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input {...field} placeholder="Boas-vindas NB" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="codigo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl><Input {...field} placeholder="boas_vindas_nb" disabled={isEditing} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="empresa" render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="BLUE">Blue</SelectItem>
                      <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="canal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Canal</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ativo" render={({ field }) => (
                <FormItem className="flex flex-col justify-end">
                  <FormLabel>Ativo</FormLabel>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="text-sm text-muted-foreground">{field.value ? 'Sim' : 'Não'}</span>
                  </div>
                </FormItem>
              )} />
            </div>

            {canal === 'EMAIL' && (
              <FormField control={form.control} name="assunto_template" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assunto do Email</FormLabel>
                  <FormControl><Input {...field} placeholder="Assunto do email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição (opcional)</FormLabel>
                <FormControl><Input {...field} placeholder="Quando usar este template" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="conteudo" render={({ field }) => (
              <FormItem>
                <FormLabel>Conteúdo</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={6} placeholder="Olá {{primeiro_nome}}, tudo bem?" />
                </FormControl>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Use {'{{placeholder}}'} para variáveis dinâmicas</span>
                  <span>{conteudo?.length ?? 0} caracteres</span>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {conteudo && (
              <div>
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <div
                  className="mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: renderPreview(conteudo) }}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
