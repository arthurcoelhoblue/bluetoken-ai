import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { getScreensByGroup, SCREEN_REGISTRY } from '@/config/screenRegistry';
import type { PermissionsMap } from '@/types/accessControl';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type TriState = 'inherit' | 'allow' | 'deny';

interface OverrideMap {
  [screenKey: string]: { view: TriState; edit: TriState };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentOverride: PermissionsMap | null;
  profilePermissions: PermissionsMap | null;
}

function toOverrideMap(override: PermissionsMap | null): OverrideMap {
  const map: OverrideMap = {};
  SCREEN_REGISTRY.forEach(s => {
    const o = override?.[s.key];
    map[s.key] = {
      view: o === undefined ? 'inherit' : o.view ? 'allow' : 'deny',
      edit: o === undefined ? 'inherit' : o.edit ? 'allow' : 'deny',
    };
  });
  return map;
}

function toPermissionsMap(overrideMap: OverrideMap): PermissionsMap | null {
  const result: PermissionsMap = {};
  let hasAny = false;
  for (const [key, val] of Object.entries(overrideMap)) {
    if (val.view !== 'inherit' || val.edit !== 'inherit') {
      result[key] = {
        view: val.view === 'allow',
        edit: val.edit === 'allow',
      };
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}

export function UserPermissionOverrideDialog({
  open, onOpenChange, userId, userName, currentOverride, profilePermissions,
}: Props) {
  const [overrides, setOverrides] = useState<OverrideMap>(() => toOverrideMap(currentOverride));
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const grouped = getScreensByGroup();

  useEffect(() => {
    if (open) setOverrides(toOverrideMap(currentOverride));
  }, [open, currentOverride]);

  const handleChange = (key: string, field: 'view' | 'edit', value: TriState) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: { ...prev[key], [field]: value } };
      // If denying view, also deny edit
      if (field === 'view' && value === 'deny') {
        next[key].edit = 'deny';
      }
      // If allowing edit, also allow view
      if (field === 'edit' && value === 'allow') {
        next[key].view = 'allow';
      }
      return next;
    });
  };

  const getEffective = (key: string, field: 'view' | 'edit'): boolean => {
    const o = overrides[key]?.[field];
    if (o === 'allow') return true;
    if (o === 'deny') return false;
    return profilePermissions?.[key]?.[field] ?? false;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const permissionsOverride = toPermissionsMap(overrides);
      const { error } = await supabase
        .from('user_access_assignments')
        .update({ permissions_override: permissionsOverride as unknown as import('@/integrations/supabase/types').Json })
        .eq('user_id', userId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['users-with-profiles'] });
      qc.invalidateQueries({ queryKey: ['screen-permissions'] });
      toast.success('Permissões individuais salvas');
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const triOptions = [
    { value: 'inherit', label: '↩ Herdar' },
    { value: 'allow', label: '✓ Permitir' },
    { value: 'deny', label: '✗ Negar' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões Individuais — {userName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Quando &quot;Herdar&quot;, vale a permissão do grupo/perfil. Permissões individuais sobrepõem as do grupo.
        </p>

        <Separator />

        <div className="rounded-lg border">
          <div className="grid grid-cols-[1fr_120px_120px_60px] gap-2 px-4 py-2 bg-muted/50 text-sm font-medium">
            <span>Tela</span>
            <span className="text-center">Visualizar</span>
            <span className="text-center">Editar</span>
            <span className="text-center text-xs text-muted-foreground">Efetivo</span>
          </div>

          {Object.entries(grouped).map(([group, screens]) => (
            <div key={group}>
              <div className="px-4 py-2 bg-muted/30">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </span>
              </div>

              {screens.map(screen => (
                <div
                  key={screen.key}
                  className="grid grid-cols-[1fr_120px_120px_60px] gap-2 px-4 py-2 border-t border-border/50 hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <screen.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{screen.label}</span>
                  </div>
                  <div className="flex justify-center">
                    <Select
                      value={overrides[screen.key]?.view ?? 'inherit'}
                      onValueChange={v => handleChange(screen.key, 'view', v as TriState)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {triOptions.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-center">
                    <Select
                      value={overrides[screen.key]?.edit ?? 'inherit'}
                      onValueChange={v => handleChange(screen.key, 'edit', v as TriState)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {triOptions.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-center items-center gap-1 text-xs">
                    <span className={getEffective(screen.key, 'view') ? 'text-green-600' : 'text-red-500'}>
                      {getEffective(screen.key, 'view') ? '👁' : '—'}
                    </span>
                    <span className={getEffective(screen.key, 'edit') ? 'text-green-600' : 'text-red-500'}>
                      {getEffective(screen.key, 'edit') ? '✏' : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
