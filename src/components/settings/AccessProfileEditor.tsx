import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { getScreensByGroup } from '@/config/screenRegistry';
import type { AccessProfile, PermissionsMap } from '@/types/accessControl';
import { SCREEN_REGISTRY } from '@/config/screenRegistry';
import { createEmptyPermissions } from '@/types/accessControl';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: AccessProfile | null;
  onSave: (data: { nome: string; descricao?: string; permissions: PermissionsMap }) => void;
  isSaving?: boolean;
}

export function AccessProfileEditor({ open, onOpenChange, profile, onSave, isSaving }: Props) {
  const screenKeys = SCREEN_REGISTRY.map(s => s.key);
  const [nome, setNome] = useState(profile?.nome ?? '');
  const [descricao, setDescricao] = useState(profile?.descricao ?? '');
  const [permissions, setPermissions] = useState<PermissionsMap>(
    profile?.permissions ?? createEmptyPermissions(screenKeys)
  );

  const grouped = getScreensByGroup();

  const handleViewChange = (key: string, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [key]: {
        view: checked,
        edit: checked ? prev[key]?.edit ?? false : false,
      },
    }));
  };

  const handleEditChange = (key: string, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [key]: {
        view: checked ? true : prev[key]?.view ?? false,
        edit: checked,
      },
    }));
  };

  const handleSelectAll = (group: string, checked: boolean) => {
    const keys = grouped[group]?.map(s => s.key) ?? [];
    setPermissions(prev => {
      const next = { ...prev };
      keys.forEach(k => {
        next[k] = { view: checked, edit: checked };
      });
      return next;
    });
  };

  const handleSubmit = () => {
    if (!nome.trim()) return;
    onSave({ nome: nome.trim(), descricao: descricao.trim() || undefined, permissions });
  };

  const isReadOnly = profile?.is_system ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? 'Editar Perfil de Acesso' : 'Criar Perfil de Acesso'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Closer Senior"
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-desc">Descrição</Label>
              <Textarea
                id="profile-desc"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descrição opcional"
                rows={1}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <Separator />

          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 bg-muted/50 text-sm font-medium">
              <span>Tela</span>
              <span className="text-center">Visualizar</span>
              <span className="text-center">Editar</span>
            </div>

            {Object.entries(grouped).map(([group, screens]) => (
              <div key={group}>
                <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 bg-muted/30">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </span>
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-1"
                      onClick={() => handleSelectAll(group, true)}
                      disabled={isReadOnly}
                    >
                      Todos
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-1"
                      onClick={() => handleSelectAll(group, false)}
                      disabled={isReadOnly}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                {screens.map(screen => (
                  <div
                    key={screen.key}
                    className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 border-t border-border/50 hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <screen.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{screen.label}</span>
                    </div>
                    <div className="flex justify-center items-center">
                      <Checkbox
                        checked={permissions[screen.key]?.view ?? false}
                        onCheckedChange={(c) => handleViewChange(screen.key, !!c)}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="flex justify-center items-center">
                      <Checkbox
                        checked={permissions[screen.key]?.edit ?? false}
                        onCheckedChange={(c) => handleEditChange(screen.key, !!c)}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isReadOnly || !nome.trim()}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
