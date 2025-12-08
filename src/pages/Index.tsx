import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Bot, 
  Users, 
  MessageSquare, 
  Calendar, 
  BarChart3, 
  Settings,
  ChevronRight,
  Zap,
  Target,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Index() {
  const { profile, roles, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  // Quick stats (placeholder data)
  const stats = [
    { label: 'Leads Hoje', value: '47', icon: Users, color: 'text-primary' },
    { label: 'Conversas Ativas', value: '12', icon: MessageSquare, color: 'text-accent' },
    { label: 'Reuniões Agendadas', value: '5', icon: Calendar, color: 'text-success' },
    { label: 'Taxa de Conversão', value: '23%', icon: TrendingUp, color: 'text-warning' },
  ];

  // Quick actions
  const quickActions = [
    { label: 'Gerenciar Leads', icon: Users, path: '/leads', description: 'Visualizar e qualificar leads' },
    { label: 'Conversas', icon: MessageSquare, path: '/conversations', description: 'Acompanhar conversas WhatsApp' },
    { label: 'Cadências', icon: Zap, path: '/cadences', description: 'Configurar automações' },
    { label: 'Analytics', icon: BarChart3, path: '/analytics', description: 'Métricas e relatórios' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
        <div className="text-center max-w-lg animate-slide-up">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center mb-6 shadow-glow animate-pulse-glow">
            <Bot className="h-10 w-10 text-primary-foreground" />
          </div>
          
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            SDR IA
          </h1>
          
          <p className="text-primary-foreground/80 mb-2 text-xl">
            Tokeniza & Blue Consult
          </p>
          
          <p className="text-primary-foreground/60 mb-8">
            Sistema de Pré-Vendas Automatizado com Inteligência Artificial
          </p>

          <Button
            variant="gradient"
            size="xl"
            onClick={() => navigate('/auth')}
            className="shadow-lg"
          >
            Acessar Sistema
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">SDR IA</h1>
              <p className="text-xs text-muted-foreground">Tokeniza & Blue</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            
            <button 
              onClick={() => navigate('/me')}
              className="flex items-center gap-3 hover:bg-secondary/50 rounded-lg px-3 py-2 transition-smooth"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{profile?.nome || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(profile?.nome || null, profile?.email || '')}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome section */}
          <div className="animate-slide-up">
            <h2 className="text-2xl font-bold mb-1">
              Olá, {profile?.nome?.split(' ')[0] || 'Usuário'}!
            </h2>
            <p className="text-muted-foreground flex items-center gap-2">
              <span>Seus papéis:</span>
              {roles.map(role => (
                <RoleBadge key={role} role={role} size="sm" />
              ))}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up animation-delay-100">
            {stats.map((stat, index) => (
              <Card key={stat.label} className="card-shadow hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                    <span className="text-2xl font-bold">{stat.value}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="animate-slide-up animation-delay-200">
            <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action) => (
                <Card 
                  key={action.label}
                  className="card-shadow hover-lift cursor-pointer group"
                  onClick={() => navigate(action.path)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-smooth">
                        <action.icon className="h-5 w-5 text-primary" />
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-smooth" />
                    </div>
                    <h4 className="font-medium mt-3">{action.label}</h4>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* SDR IA Status Card */}
          <Card className="bg-gradient-hero text-primary-foreground animate-slide-up animation-delay-300">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary-foreground/10 flex items-center justify-center">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-primary-foreground">SDR IA Ativo</CardTitle>
                  <CardDescription className="text-primary-foreground/70">
                    Processando leads automaticamente
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-primary-foreground/10 rounded-lg p-3">
                  <p className="text-2xl font-bold">127</p>
                  <p className="text-sm text-primary-foreground/70">Leads processados hoje</p>
                </div>
                <div className="bg-primary-foreground/10 rounded-lg p-3">
                  <p className="text-2xl font-bold">89%</p>
                  <p className="text-sm text-primary-foreground/70">Taxa de resposta</p>
                </div>
                <div className="bg-primary-foreground/10 rounded-lg p-3">
                  <p className="text-2xl font-bold">2.3s</p>
                  <p className="text-sm text-primary-foreground/70">Tempo médio resposta</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
