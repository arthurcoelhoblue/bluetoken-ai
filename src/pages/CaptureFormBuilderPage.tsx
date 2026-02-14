import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { WebhookExternoCard } from '@/components/capture-forms/WebhookExternoCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormFieldEditor } from '@/components/capture-forms/FormFieldEditor';
import { useCaptureForm, useUpdateCaptureForm } from '@/hooks/useCaptureForms';
import { usePipelines } from '@/hooks/usePipelines';
import { Plus, Save, ArrowLeft, Eye, Send } from 'lucide-react';
import type { CaptureFormField, CaptureFormSettings } from '@/types/captureForms';

function BuilderContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: form, isLoading } = useCaptureForm(id);
  const updateForm = useUpdateCaptureForm();
  const { data: pipelines } = usePipelines();

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fields, setFields] = useState<CaptureFormField[]>([]);
  const [settings, setSettings] = useState<CaptureFormSettings>({});
  const [pipelineId, setPipelineId] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');

  useEffect(() => {
    if (form) {
      setNome(form.nome);
      setDescricao(form.descricao || '');
      setFields(form.fields || []);
      setSettings(form.settings || {});
      setPipelineId(form.pipeline_id || '');
      setStageId(form.stage_id || '');
      setStatus(form.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT');
    }
  }, [form]);

  const selectedPipeline = pipelines?.find(p => p.id === pipelineId);
  const stages = selectedPipeline?.pipeline_stages || [];

  const addField = () => {
    const newField: CaptureFormField = {
      id: crypto.randomUUID(),
      type: 'short_text',
      label: '',
      required: false,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updated: CaptureFormField) => {
    const copy = [...fields];
    copy[index] = updated;
    setFields(copy);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = async (publish = false) => {
    if (!id) return;
    const newStatus = publish ? 'PUBLISHED' : status;
    await updateForm.mutateAsync({
      id,
      nome,
      descricao: descricao || null,
      fields,
      settings,
      pipeline_id: pipelineId || null,
      stage_id: stageId || null,
      status: newStatus,
    });
    if (publish) setStatus('PUBLISHED');
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="py-12 text-center text-muted-foreground">Carregando formulário...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-6">
        <div className="py-12 text-center text-muted-foreground">Formulário não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editar: {nome}</h1>
          <p className="text-muted-foreground">Configure as perguntas e o destino dos leads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/capture-forms')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button variant="outline" onClick={() => window.open(`/f/${form.slug}`, '_blank')}>
            <Eye className="h-4 w-4 mr-2" />
            Visualizar
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={updateForm.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar rascunho
          </Button>
          <Button onClick={() => handleSave(true)} disabled={updateForm.isPending}>
            <Send className="h-4 w-4 mr-2" />
            Publicar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fields column */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-lg">Perguntas</h3>
          {fields.length === 0 && (
            <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground">
              Nenhuma pergunta adicionada. Clique abaixo para começar.
            </div>
          )}
          {fields.map((field, i) => (
            <FormFieldEditor
              key={field.id}
              field={field}
              index={i}
              onChange={updated => updateField(i, updated)}
              onRemove={() => removeField(i)}
            />
          ))}
          <Button variant="outline" className="w-full" onClick={addField}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar pergunta
          </Button>
        </div>

        {/* Config column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do formulário</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Destino do Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Pipeline</Label>
                <Select value={pipelineId} onValueChange={v => { setPipelineId(v); setStageId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(pipelines || []).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {stages.length > 0 && (
                <div>
                  <Label>Estágio inicial</Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {stages.map((s: { id: string; nome: string }) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Cor principal</Label>
                <Input
                  type="color"
                  value={settings.primary_color || '#6366f1'}
                  onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                  className="h-10 w-full"
                />
              </div>
              <div>
                <Label>Título de agradecimento</Label>
                <Input
                  value={settings.thank_you_title || ''}
                  onChange={e => setSettings({ ...settings, thank_you_title: e.target.value })}
                  placeholder="Obrigado!"
                />
              </div>
              <div>
                <Label>Mensagem de conclusão</Label>
                <Textarea
                  value={settings.thank_you_message || ''}
                  onChange={e => setSettings({ ...settings, thank_you_message: e.target.value })}
                  placeholder="Suas informações foram enviadas com sucesso."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {form.slug && (
            <WebhookExternoCard slug={form.slug} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CaptureFormBuilderPage() {
  return (
    <AppLayout>
      <BuilderContent />
    </AppLayout>
  );
}
