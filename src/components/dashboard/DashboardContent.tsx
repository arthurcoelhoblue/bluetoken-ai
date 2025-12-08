import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  MessageSquare, 
  Zap,
  Target,
  TrendingUp,
  Play,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function DashboardContent() {
  const { profile, roles } = useAuth();
  const navigate = useNavigate();

  // Fetch real stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Events today
      const { count: eventsToday } = await supabase
        .from('sgt_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO);

      // Active runs
      const { count: activeRuns } = await supabase
        .from('lead_cadence_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ATIVA');

      // Runs started today
      const { count: runsToday } = await supabase
        .from('lead_cadence_runs')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', todayISO);

      // Completed runs today
      const { count: completedToday } = await supabase
        .from('lead_cadence_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'CONCLUIDA')
        .gte('updated_at', todayISO);

      // Next actions pending (overdue)
      const now = new Date().toISOString();
      const { count: overdueActions } = await supabase
        .from('lead_cadence_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ATIVA')
        .lt('next_run_at', now);

      return {
        eventsToday: eventsToday || 0,
        activeRuns: activeRuns || 0,
        runsToday: runsToday || 0,
        completedToday: completedToday || 0,
        overdueActions: overdueActions || 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const statsCards = [
    { label: 'Eventos Hoje', value: stats?.eventsToday ?? '-', icon: MessageSquare, color: 'text-primary' },
    { label: 'Cadências Ativas', value: stats?.activeRuns ?? '-', icon: Play, color: 'text-success' },
    { label: 'Iniciadas Hoje', value: stats?.runsToday ?? '-', icon: Zap, color: 'text-accent' },
    { label: 'Concluídas Hoje', value: stats?.completedToday ?? '-', icon: CheckCircle2, color: 'text-muted-foreground' },
  ];

  const quickActions = [
    { label: 'Gerenciar Leads', icon: Users, path: '/leads', description: 'Visualizar e qualificar leads' },
    { label: 'Leads em Cadência', icon: Play, path: '/cadences/runs', description: 'Acompanhar execuções' },
    { label: 'Próximas Ações', icon: Clock, path: '/cadences/next-actions', description: 'Ações pendentes' },
    { label: 'Cadências', icon: Zap, path: '/cadences', description: 'Configurar automações' },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
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
        {statsCards.map((stat) => (
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

      {/* Alert for overdue actions */}
      {stats?.overdueActions && stats.overdueActions > 0 && (
        <Card className="border-warning bg-warning/5 animate-slide-up animation-delay-150">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-warning" />
              <span className="font-medium">
                {stats.overdueActions} {stats.overdueActions === 1 ? 'ação atrasada' : 'ações atrasadas'}
              </span>
            </div>
            <button
              onClick={() => navigate('/cadences/next-actions')}
              className="text-sm text-primary hover:underline"
            >
              Ver detalhes →
            </button>
          </CardContent>
        </Card>
      )}

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
              <p className="text-2xl font-bold">{stats?.eventsToday ?? '-'}</p>
              <p className="text-sm text-primary-foreground/70">Eventos hoje</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-3">
              <p className="text-2xl font-bold">{stats?.activeRuns ?? '-'}</p>
              <p className="text-sm text-primary-foreground/70">Cadências ativas</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-3">
              <p className="text-2xl font-bold">{stats?.runsToday ?? '-'}</p>
              <p className="text-sm text-primary-foreground/70">Iniciadas hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
