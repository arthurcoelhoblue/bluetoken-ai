import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Copy, Plus, Lock } from 'lucide-react';
import { useAccessProfiles, useCreateAccessProfile, useUpdateAccessProfile, useDeleteAccessProfile } from '@/hooks/useAccessControl';
import { AccessProfileEditor } from './AccessProfileEditor';
import type { AccessProfile, PermissionsMap } from '@/types/accessControl';
import { SCREEN_REGISTRY } from '@/config/screenRegistry';

export function AccessProfileList() {
  const { data: profiles = [], isLoading } = useAccessProfiles();
  const createMutation = useCreateAccessProfile();
  const updateMutation = useUpdateAccessProfile();
  const deleteMutation = useDeleteAccessProfile();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AccessProfile | null>(null);

  const handleCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (p: AccessProfile) => {
    setEditing(p);
    setEditorOpen(true);
  };

  const handleDuplicate = (p: AccessProfile) => {
    setEditing({
      ...p,
      id: '',
      nome: `${p.nome} (cópia)`,
      is_system: false,
    });
    setEditorOpen(true);
  };

  const handleSave = (data: { nome: string; descricao?: string; permissions: PermissionsMap }) => {
    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, ...data }, { onSuccess: () => setEditorOpen(false) });
    } else {
      createMutation.mutate(data, { onSuccess: () => setEditorOpen(false) });
    }
  };

  const countPermissions = (perms: PermissionsMap) => {
    const total = SCREEN_REGISTRY.length;
    const viewCount = Object.values(perms).filter(p => p?.view).length;
    const editCount = Object.values(perms).filter(p => p?.edit).length;
    return { total, viewCount, editCount };
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando perfis...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Perfis de Acesso</h3>
          <p className="text-sm text-muted-foreground">
            Configure quais telas cada perfil pode acessar
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Perfil
        </Button>
      </div>

      <div className="grid gap-3">
        {profiles.map(p => {
          const { total, viewCount, editCount } = countPermissions(p.permissions);
          return (
            <Card key={p.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.nome}</span>
                    {p.is_system && (
                      <Badge 
                        variant={p.nome === 'Super Admin' ? 'default' : 'secondary'} 
                        className="gap-1 text-xs"
                      >
                        <Lock className="h-3 w-3" />
                        {p.nome === 'Super Admin' ? 'Super Admin' : 'Sistema'}
                      </Badge>
                    )}
                  </div>
                  {p.descricao && (
                    <p className="text-sm text-muted-foreground">{p.descricao}</p>
                  )}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>👁 {viewCount}/{total} telas</span>
                    <span>✏️ {editCount}/{total} editáveis</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(p)} title="Duplicar">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!p.is_system && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(p.id)}
                      className="text-destructive hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AccessProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editing}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
