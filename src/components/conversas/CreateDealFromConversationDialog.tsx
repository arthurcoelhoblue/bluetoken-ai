import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { usePipelines } from '@/hooks/usePipelines';
import { useCreateDeal } from '@/hooks/useDeals';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreateDealFromConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactNome: string;
  empresa: string;
  onDealCreated: (dealId: string) => void;
}

export function CreateDealFromConversationDialog({
  open,
  onOpenChange,
  contactId,
  contactNome,
  empresa,
  onDealCreated,
}: CreateDealFromConversationDialogProps) {
  const { data: pipelines = [] } = usePipelines();
  const createDeal = useCreateDeal();
  const { user } = useAuth();

  const companyPipelines = pipelines.filter((p) => p.empresa === empresa);

  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [titulo, setTitulo] = useState(contactNome || 'Novo Deal');
  const [valor, setValor] = useState('');

  const selectedPipeline = companyPipelines.find((p) => p.id === pipelineId);
  const stages = (selectedPipeline?.pipeline_stages ?? []).filter(
    (s) => !s.is_won && !s.is_lost
  );

  const handlePipelineChange = (id: string) => {
    setPipelineId(id);
    setStageId('');
    // Auto-select first stage
    const p = companyPipelines.find((pp) => pp.id === id);
    const openStages = (p?.pipeline_stages ?? []).filter(
      (s) => !s.is_won && !s.is_lost
    );
    if (openStages.length > 0) {
      setStageId(openStages[0].id);
    }
  };

  const handleSubmit = () => {
    if (!pipelineId || !stageId) {
      toast.error('Selecione pipeline e estágio');
      return;
    }

    createDeal.mutate(
      {
        titulo: titulo.trim() || contactNome || 'Novo Deal',
        contact_id: contactId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        valor: Number(valor) || 0,
        owner_id: user?.id,
      },
      {
        onSuccess: (deal) => {
          toast.success('Deal criado com sucesso!');
          onDealCreated(deal.id);
          onOpenChange(false);
        },
        onError: () => toast.error('Erro ao criar deal'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Deal para Conversa</DialogTitle>
          <DialogDescription>
            Para iniciar uma conversa, é necessário vincular a um deal no funil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Pipeline</Label>
            <Select value={pipelineId} onValueChange={handlePipelineChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pipeline" />
              </SelectTrigger>
              <SelectContent>
                {companyPipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estágio</Label>
            <Select
              value={stageId}
              onValueChange={setStageId}
              disabled={!pipelineId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estágio" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nome do deal"
            />
          </div>

          <div className="space-y-2">
            <Label>Valor (opcional)</Label>
            <Input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!pipelineId || !stageId || createDeal.isPending}
          >
            {createDeal.isPending ? 'Criando...' : 'Criar Deal e Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
