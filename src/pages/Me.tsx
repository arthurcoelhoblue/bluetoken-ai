import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  LogOut, 
  Mail, 
  Calendar, 
  Clock, 
  Building2,
  CheckCircle2,
  XCircle,
  Bot,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Me() {
  const { profile, roles, signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">SDR IA</span>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
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
                  <span className="text-sm">Google OAuth</span>
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
      </main>
    </div>
  );
}
