import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccessProfiles } from '@/hooks/useAccessControl';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUPER_ADMIN_NAME = 'Super Admin';

export function CreateUserDialog({ open, onOpenChange }: Props) {
  const { data: profiles = [] } = useAccessProfiles();
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-profiles-for-gestor'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, email').order('nome');
      if (error) throw error;
      return data ?? [];
    },
  });
  const queryClient = useQueryClient();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileId, setProfileId] = useState('');
  const [empresa, setEmpresa] = useState('all');
  const [gestorId, setGestorId] = useState('none');
  const [isVendedor, setIsVendedor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableProfiles = profiles.filter(p => p.nome !== SUPER_ADMIN_NAME);

  const resetForm = () => {
    setNome('');
    setEmail('');
    setPassword('');
    setProfileId('');
    setEmpresa('all');
    setGestorId('none');
    setIsVendedor(false);
  };

  const handleSubmit = async () => {
    if (!nome.trim() || !email.trim() || !password.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: email.trim(),
          nome: nome.trim(),
          password,
          access_profile_id: profileId || undefined,
          empresa: empresa === 'all' ? undefined : empresa,
          gestor_id: gestorId === 'none' ? undefined : gestorId,
          is_vendedor: isVendedor,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Usuário ${nome} criado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['users-with-profiles'] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" />
          </div>

          <div className="space-y-2">
            <Label>Senha temporária *</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>

          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Gestor</Label>
            <Select value={gestorId} onValueChange={setGestorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gestor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {allUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nome || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Vendedor</Label>
              <p className="text-xs text-muted-foreground">Este usuário participa de metas, comissões e rankings</p>
            </div>
            <Switch checked={isVendedor} onCheckedChange={setIsVendedor} />
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Criando...' : 'Criar Usuário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
