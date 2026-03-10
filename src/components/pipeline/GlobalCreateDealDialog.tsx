import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { usePipelines } from '@/hooks/usePipelines';
import { CreateDealDialog } from './CreateDealDialog';

interface GlobalCreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalCreateDealDialog({ open, onOpenChange }: GlobalCreateDealDialogProps) {
  const { data: pipelines = [] } = usePipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  // Auto-select first pipeline
  useEffect(() => {
    if (open && pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [open, pipelines, selectedPipelineId]);

  // Reset on close
  useEffect(() => {
    if (!open) setSelectedPipelineId('');
  }, [open]);

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  const stages = selectedPipeline?.pipeline_stages ?? [];

  // If only one pipeline, skip selection and show deal form directly
  if (open && pipelines.length === 1 && selectedPipeline) {
    return (
      <CreateDealDialog
        open={open}
        onOpenChange={onOpenChange}
        pipelineId={selectedPipeline.id}
        stages={stages}
      />
    );
  }

  // If pipeline selected, show deal form
  if (open && selectedPipeline) {
    return (
      <CreateDealDialog
        open={open}
        onOpenChange={onOpenChange}
        pipelineId={selectedPipeline.id}
        stages={stages}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Selecione o pipeline</Label>
          <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um pipeline..." />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DialogContent>
    </Dialog>
  );
}
