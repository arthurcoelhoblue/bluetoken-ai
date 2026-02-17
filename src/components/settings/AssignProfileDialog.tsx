import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAccessProfiles, useAssignProfile } from '@/hooks/useAccessControl';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentProfileId?: string | null;
  currentEmpresas?: ('BLUE' | 'TOKENIZA')[];
}

const AVAILABLE_EMPRESAS: { value: 'BLUE' | 'TOKENIZA'; label: string }[] = [
  { value: 'BLUE', label: 'Blue Consult' },
  { value: 'TOKENIZA', label: 'Tokeniza' },
];

export function AssignProfileDialog({ open, onOpenChange, userId, userName, currentProfileId, currentEmpresas }: Props) {
  const { data: profiles = [] } = useAccessProfiles();
  const assignMutation = useAssignProfile();

  const [profileId, setProfileId] = useState(currentProfileId ?? '');
  const [selectedEmpresas, setSelectedEmpresas] = useState<('BLUE' | 'TOKENIZA')[]>(
    currentEmpresas && currentEmpresas.length > 0 ? currentEmpresas : ['BLUE']
  );

  const toggleEmpresa = (empresa: 'BLUE' | 'TOKENIZA') => {
    setSelectedEmpresas(prev => {
      if (prev.includes(empresa)) {
        // Don't allow deselecting all
        if (prev.length <= 1) return prev;
        return prev.filter(e => e !== empresa);
      }
      return [...prev, empresa];
    });
  };

  const handleSave = () => {
    if (!profileId || selectedEmpresas.length === 0) return;
    assignMutation.mutate(
      { user_id: userId, access_profile_id: profileId, empresas: selectedEmpresas },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir Perfil — {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                {profiles.filter(p => p.nome !== 'Super Admin').map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Empresas</Label>
            <div className="space-y-2">
              {AVAILABLE_EMPRESAS.map(emp => (
                <label key={emp.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedEmpresas.includes(emp.value)}
                    onCheckedChange={() => toggleEmpresa(emp.value)}
                  />
                  <span className="text-sm">{emp.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!profileId || selectedEmpresas.length === 0 || assignMutation.isPending}>
            {assignMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}