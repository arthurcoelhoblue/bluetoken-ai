import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAccessProfiles, useAssignProfile } from '@/hooks/useAccessControl';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();

  const [profileId, setProfileId] = useState(currentProfileId ?? '');
  const [selectedEmpresas, setSelectedEmpresas] = useState<('BLUE' | 'TOKENIZA')[]>(
    currentEmpresas && currentEmpresas.length > 0 ? currentEmpresas : ['BLUE']
  );
  const [ramal, setRamal] = useState('');

  useEffect(() => {
    if (open && userId) {
      supabase.from('zadarma_extensions').select('extension_number').eq('user_id', userId).limit(1).single()
        .then(({ data }) => setRamal(data?.extension_number ?? ''));
    }
  }, [open, userId]);

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

  const handleSave = async () => {
    if (!profileId || selectedEmpresas.length === 0) return;
    assignMutation.mutate(
      { user_id: userId, access_profile_id: profileId, empresas: selectedEmpresas },
      {
        onSuccess: async () => {
          // Save ramal
          if (ramal) {
            await supabase.from('zadarma_extensions').upsert(
              { user_id: userId, extension_number: ramal, empresa: selectedEmpresas[0] },
              { onConflict: 'user_id,empresa' }
            );
          } else {
            await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
          }
          queryClient.invalidateQueries({ queryKey: ['zadarma-extensions-all'] });
          queryClient.invalidateQueries({ queryKey: ['zadarma-my-extension'] });
          onOpenChange(false);
        },
      }
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
          <div className="space-y-2">
            <Label>Ramal</Label>
            <Input value={ramal} onChange={e => setRamal(e.target.value)} placeholder="Ex: 100" />
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