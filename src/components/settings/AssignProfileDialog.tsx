import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccessProfiles, useAssignProfile } from '@/hooks/useAccessControl';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentProfileId?: string | null;
  currentEmpresa?: string | null;
}

export function AssignProfileDialog({ open, onOpenChange, userId, userName, currentProfileId, currentEmpresa }: Props) {
  const { data: profiles = [] } = useAccessProfiles();
  const assignMutation = useAssignProfile();

  const [profileId, setProfileId] = useState(currentProfileId ?? '');
  const [empresa, setEmpresa] = useState<string>(currentEmpresa ?? 'all');

  const handleSave = () => {
    if (!profileId) return;
    assignMutation.mutate(
      { user_id: userId, access_profile_id: profileId, empresa: empresa === 'all' ? null : empresa as 'BLUE' | 'TOKENIZA' },
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
            <Label>Empresa</Label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="BLUE">Blue</SelectItem>
                <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!profileId || assignMutation.isPending}>
            {assignMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
