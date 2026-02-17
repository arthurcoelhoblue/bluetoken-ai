import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  Calendar, 
  Clock, 
  Building2,
  CheckCircle2,
  XCircle,
  Lock,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function MeContent() {
  const { profile, roles, user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setIsChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error('Erro ao alterar senha. Tente novamente.');
    } else {
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsChangingPassword(false);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="space-y-6 animate-slide-up">
        {/* Profile Card */}
        <Card className="card-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(profile.nome, profile.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {profile.nome || 'Usuário'}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-3">
                  {roles.map(role => (
                    <RoleBadge key={role} role={role} size="sm" />
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Details Card */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Detalhes da Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3 text-muted-foreground">
                {profile.is_active ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span>Status da Conta</span>
              </div>
              <span className={profile.is_active ? 'text-success' : 'text-destructive'}>
                {profile.is_active ? 'Ativa' : 'Desativada'}
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Building2 className="h-5 w-5" />
                <span>Empresa</span>
              </div>
              <span className="text-foreground">
                {profile.empresa_id ? 'Vinculada' : 'Não vinculada'}
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>Último Acesso</span>
              </div>
              <span className="text-foreground text-sm">
                {formatDate(profile.last_login_at)}
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span>Membro desde</span>
              </div>
              <span className="text-foreground text-sm">
                {formatDate(profile.created_at)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pw">Nova Senha</Label>
                <Input
                  id="new-pw"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isChangingPassword}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isChangingPassword}>
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Alterar Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Session Info */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Informações da Sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">ID do Usuário</span>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                  {user?.id?.slice(0, 8)}...
                </code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Provider</span>
                <span className="text-sm capitalize">
                  {user?.app_metadata?.provider || user?.app_metadata?.providers?.[0] || 'Email'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Google ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                  {profile.google_id?.slice(0, 8) || 'N/A'}...
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Me() {
  return (
    <AppLayout>
      <MeContent />
    </AppLayout>
  );
}
