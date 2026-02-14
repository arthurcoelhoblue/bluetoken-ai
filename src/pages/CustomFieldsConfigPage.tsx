import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { SlidersHorizontal, Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { useAllFieldDefinitions, useCreateFieldDefinition, useUpdateFieldDefinition, useDeleteFieldDefinition } from '@/hooks/useCustomFields';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { CustomFieldEntityType, CustomFieldValueType, CustomFieldDefinition, CustomFieldFormData } from '@/types/customFields';

const ENTITY_TYPES: CustomFieldEntityType[] = ['CONTACT', 'ORGANIZATION', 'DEAL'];
const VALUE_TYPES: CustomFieldValueType[] = [
  'TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME',
  'BOOLEAN', 'SELECT', 'MULTISELECT', 'EMAIL', 'PHONE', 'URL', 'PERCENT', 'TAG',
];

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function CustomFieldsContent() {
  const { data: fields, isLoading } = useAllFieldDefinitions();
  const createField = useCreateFieldDefinition();
  const updateField = useUpdateFieldDefinition();
  const deleteField = useDeleteFieldDefinition();

  const [filterEntity, setFilterEntity] = useState<CustomFieldEntityType | 'ALL'>('ALL');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);

  const [formLabel, setFormLabel] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formEntity, setFormEntity] = useState<CustomFieldEntityType>('CONTACT');
  const [formValueType, setFormValueType] = useState<CustomFieldValueType>('TEXT');
  const [formEmpresa, setFormEmpresa] = useState<'BLUE' | 'TOKENIZA'>('BLUE');
  const [formGrupo, setFormGrupo] = useState('Geral');
  const [formRequired, setFormRequired] = useState(false);
  const [formVisible, setFormVisible] = useState(true);

  const grupos = [...new Set((fields ?? []).map(f => f.grupo))].sort();

  const filtered = (fields ?? []).filter(f => {
    if (filterEntity !== 'ALL' && f.entity_type !== filterEntity) return false;
    if (filterGrupo && f.grupo !== filterGrupo) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setFormLabel('');
    setFormSlug('');
    setFormEntity('CONTACT');
    setFormValueType('TEXT');
    setFormEmpresa('BLUE');
    setFormGrupo('Geral');
    setFormRequired(false);
    setFormVisible(true);
    setDialogOpen(true);
  };

  const openEdit = (f: CustomFieldDefinition) => {
    setEditing(f);
    setFormLabel(f.label);
    setFormSlug(f.slug);
    setFormEntity(f.entity_type);
    setFormValueType(f.value_type);
    setFormEmpresa(f.empresa);
    setFormGrupo(f.grupo);
    setFormRequired(f.is_required);
    setFormVisible(f.is_visible);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) return;
    const slug = formSlug.trim() || slugify(formLabel);
    try {
      if (editing) {
        await updateField.mutateAsync({
          id: editing.id,
          label: formLabel.trim(),
          value_type: formValueType,
          grupo: formGrupo,
          is_required: formRequired,
          is_visible: formVisible,
        });
        toast.success('Campo atualizado');
      } else {
        await createField.mutateAsync({
          empresa: formEmpresa,
          entity_type: formEntity,
          slug,
          label: formLabel.trim(),
          value_type: formValueType,
          grupo: formGrupo,
          is_required: formRequired,
          is_visible: formVisible,
        });
        toast.success('Campo criado');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (f: CustomFieldDefinition) => {
    if (f.is_system) {
      toast.error('Campos de sistema não podem ser excluídos');
      return;
    }
    try {
      await deleteField.mutateAsync(f.id);
      toast.success('Campo excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterEntity} onValueChange={v => setFilterEntity(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas entidades</SelectItem>
            {ENTITY_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterGrupo || '__all'} onValueChange={v => setFilterGrupo(v === '__all' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos grupos</SelectItem>
            {grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Campo</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-center">Obrig.</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {f.is_system && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    {f.label}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">{f.slug}</TableCell>
                <TableCell><Badge variant="outline">{f.entity_type}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{f.value_type}</Badge></TableCell>
                <TableCell>{f.grupo}</TableCell>
                <TableCell><Badge variant="outline">{f.empresa}</Badge></TableCell>
                <TableCell className="text-center">{f.is_required ? '✓' : ''}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => handleDelete(f)}
                      disabled={f.is_system}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} campo(s)</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Campo' : 'Novo Campo Customizado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input value={formLabel} onChange={e => { setFormLabel(e.target.value); if (!editing) setFormSlug(slugify(e.target.value)); }} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={formSlug} onChange={e => setFormSlug(e.target.value)} disabled={!!editing} className="font-mono text-sm" />
            </div>
            {!editing && (
              <>
                <div>
                  <Label>Entidade</Label>
                  <Select value={formEntity} onValueChange={v => setFormEntity(v as CustomFieldEntityType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Select value={formEmpresa} onValueChange={v => setFormEmpresa(v as 'BLUE' | 'TOKENIZA')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BLUE">Blue</SelectItem>
                      <SelectItem value="TOKENIZA">Tokeniza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label>Tipo de valor</Label>
              <Select value={formValueType} onValueChange={v => setFormValueType(v as CustomFieldValueType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Grupo</Label>
              <Input value={formGrupo} onChange={e => setFormGrupo(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Obrigatório</Label>
              <Switch checked={formRequired} onCheckedChange={setFormRequired} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Visível</Label>
              <Switch checked={formVisible} onCheckedChange={setFormVisible} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={createField.isPending || updateField.isPending}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomFieldsConfigPage() {
  return (
    <AppLayout>
      <PageShell
        icon={SlidersHorizontal}
        title="Campos Customizáveis"
        description="Defina campos personalizados para Contatos, Organizações e Deals."
      />
      <div className="px-6 pb-8">
        <CustomFieldsContent />
      </div>
    </AppLayout>
  );
}
