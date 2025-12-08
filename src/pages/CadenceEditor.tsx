import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Plus, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StepEditor } from '@/components/cadences/StepEditor';
import {
  useCadenceForEdit,
  useMessageTemplates,
  useSaveCadence,
  createEmptyCadence,
  createEmptyStep,
  type CadenceFormData,
  type StepFormData,
} from '@/hooks/useCadenceEditor';
import type { EmpresaTipo, CanalTipo } from '@/types/cadence';
import { EMPRESA_LABELS, CANAL_LABELS } from '@/types/cadence';

function CadenceEditorContent() {
  const { cadenceId } = useParams<{ cadenceId: string }>();
  const navigate = useNavigate();
  const isEditMode = !!cadenceId;

  const { data: existingData, isLoading: isLoadingCadence } = useCadenceForEdit(cadenceId);
  const { data: templates = [], isLoading: isLoadingTemplates } = useMessageTemplates();
  const saveMutation = useSaveCadence();

  const [formData, setFormData] = useState<CadenceFormData>(createEmptyCadence());
  const [hasChanges, setHasChanges] = useState(false);

  // Carregar dados existentes para edição
  useEffect(() => {
    if (existingData) {
      const { cadence, steps } = existingData;
      setFormData({
        empresa: cadence.empresa as EmpresaTipo,
        codigo: cadence.codigo,
        nome: cadence.nome,
        descricao: cadence.descricao || '',
        canal_principal: cadence.canal_principal as CanalTipo,
        ativo: cadence.ativo,
        steps: steps.map((s) => ({
          id: s.id,
          ordem: s.ordem,
          canal: s.canal as CanalTipo,
          template_codigo: s.template_codigo,
          offset_minutos: s.offset_minutos,
          parar_se_responder: s.parar_se_responder,
        })),
      });
      setHasChanges(false);
    }
  }, [existingData]);

  const updateFormData = <K extends keyof CadenceFormData>(
    key: K,
    value: CadenceFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateStep = (index: number, step: StepFormData) => {
    const newSteps = [...formData.steps];
    newSteps[index] = step;
    updateFormData('steps', newSteps);
  };

  const addStep = () => {
    const newStep = createEmptyStep(formData.steps.length + 1);
    newStep.canal = formData.canal_principal;
    updateFormData('steps', [...formData.steps, newStep]);
  };

  const removeStep = (index: number) => {
    if (formData.steps.length <= 1) return;
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Reordenar
    newSteps.forEach((step, i) => (step.ordem = i + 1));
    updateFormData('steps', newSteps);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.steps.length) return;

    const newSteps = [...formData.steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    // Reordenar
    newSteps.forEach((step, i) => (step.ordem = i + 1));
    updateFormData('steps', newSteps);
  };

  const validateForm = (): string | null => {
    if (!formData.nome.trim()) return 'Nome é obrigatório';
    if (!formData.codigo.trim()) return 'Código é obrigatório';
    if (formData.steps.length === 0) return 'Adicione pelo menos um step';
    
    for (let i = 0; i < formData.steps.length; i++) {
      if (!formData.steps[i].template_codigo) {
        return `Step ${i + 1}: selecione um template`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      return; // Toast já é mostrado pelo hook
    }

    try {
      const result = await saveMutation.mutateAsync({
        cadenceId,
        data: formData,
      });
      navigate(`/cadences/${result.id}`);
    } catch {
      // Erro já tratado pelo hook
    }
  };

  if (isEditMode && isLoadingCadence) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const validationError = validateForm();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? 'Editar Cadência' : 'Nova Cadência'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode
                ? 'Modifique os dados e steps da cadência'
                : 'Configure uma nova cadência de mensagens'}
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !!validationError}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Aviso para cadência ativa */}
      {isEditMode && formData.ativo && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta cadência está <strong>ativa</strong>. Alterações afetarão apenas
            novas execuções. Runs já iniciadas continuarão com a configuração
            anterior.
          </AlertDescription>
        </Alert>
      )}

      {/* Erros de validação */}
      {validationError && hasChanges && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Metadados */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Empresa */}
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={formData.empresa}
                onValueChange={(v) => updateFormData('empresa', v as EmpresaTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EMPRESA_LABELS) as EmpresaTipo[]).map((emp) => (
                    <SelectItem key={emp} value={emp}>
                      {EMPRESA_LABELS[emp]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label>Nome da Cadência</Label>
              <Input
                value={formData.nome}
                onChange={(e) => updateFormData('nome', e.target.value)}
                placeholder="Ex: Inbound Lead Novo"
              />
            </div>

            {/* Código */}
            <div className="space-y-2">
              <Label>Código (identificador único)</Label>
              <Input
                value={formData.codigo}
                onChange={(e) =>
                  updateFormData('codigo', e.target.value.toUpperCase().replace(/\s/g, '_'))
                }
                placeholder="Ex: TOKENIZA_INBOUND_LEAD_NOVO"
              />
              <p className="text-xs text-muted-foreground">
                Usado internamente pelo motor de cadências
              </p>
            </div>

            {/* Canal Principal */}
            <div className="space-y-2">
              <Label>Canal Principal</Label>
              <Select
                value={formData.canal_principal}
                onValueChange={(v) => updateFormData('canal_principal', v as CanalTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CANAL_LABELS) as CanalTipo[]).map((canal) => (
                    <SelectItem key={canal} value={canal}>
                      {CANAL_LABELS[canal]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => updateFormData('descricao', e.target.value)}
                placeholder="Descreva o objetivo desta cadência..."
                rows={3}
              />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="ativo" className="cursor-pointer">
                Cadência Ativa
              </Label>
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => updateFormData('ativo', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Steps da Cadência</CardTitle>
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Step
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : (
              <div className="space-y-4">
                {formData.steps.map((step, index) => (
                  <StepEditor
                    key={step.id || index}
                    step={step}
                    index={index}
                    totalSteps={formData.steps.length}
                    templates={templates}
                    empresa={formData.empresa}
                    onChange={(s) => updateStep(index, s)}
                    onMoveUp={() => moveStep(index, 'up')}
                    onMoveDown={() => moveStep(index, 'down')}
                    onRemove={() => removeStep(index)}
                  />
                ))}

                {formData.steps.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum step adicionado. Clique em "Adicionar Step" para começar.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CadenceEditor() {
  return (
    <AppLayout>
      <CadenceEditorContent />
    </AppLayout>
  );
}
