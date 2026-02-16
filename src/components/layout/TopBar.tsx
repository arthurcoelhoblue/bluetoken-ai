import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sun, Moon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Meu Dia',
  '/meu-dia': 'Meu Dia',
  '/pipeline': 'Pipeline',
  '/contatos': 'Contatos',
  '/organizacoes': 'Organizações',
  '/conversas': 'Conversas',
  '/metas': 'Metas & Comissões',
  '/renovacao': 'Renovação',
  '/cockpit': 'Cockpit',
  '/amelia': 'Amélia IA',
  '/amelia/mass-action': 'Ação em Massa',
  '/cadences': 'Cadências',
  '/cadences/runs': 'Leads em Cadência',
  '/cadences/next-actions': 'Próximas Ações',
  '/cadencias-crm': 'Cadências CRM',
  '/templates': 'Templates',
  '/leads': 'Leads',
  '/relatorios': 'Relatórios',
  '/admin/produtos': 'Knowledge Base',
  '/integracoes': 'Integrações',
  '/admin/ai-benchmark': 'Benchmark IA',
  '/monitor/sgt-events': 'Monitor SGT',
  '/admin/leads-quentes': 'Leads Quentes',
  '/admin/settings': 'Configurações',
  '/admin/zadarma': 'Telefonia',
  '/settings/pipelines': 'Configuração de Funis',
  '/settings/custom-fields': 'Campos Customizáveis',
  '/capture-forms': 'Formulários de Captura',
  '/importacao': 'Importação',
  '/pendencias': 'Pendências',
  '/me': 'Meu Perfil',
  '/tokeniza/offers': 'Ofertas Tokeniza',
  '/cs': 'Dashboard CS',
  '/cs/clientes': 'Clientes CS',
  '/cs/pesquisas': 'Pesquisas CS',
  '/cs/pesquisas/massa': 'Pesquisa em Massa',
  '/cs/incidencias': 'Incidências CS',
  '/cs/playbooks': 'Playbooks CS',
  '/wiki': 'Wiki',
};

function getTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/leads/')) return 'Detalhe do Lead';
  if (pathname.startsWith('/cadences/runs/')) return 'Detalhe da Cadência';
  if (pathname.startsWith('/cadences/') && pathname.endsWith('/edit')) return 'Editar Cadência';
  if (pathname === '/cadences/new') return 'Nova Cadência';
  if (pathname.startsWith('/cadences/')) return 'Cadência';
  if (pathname.startsWith('/admin/produtos/')) return 'Produto';
  if (pathname.startsWith('/cs/clientes/')) return 'Cliente CS';
  return 'Amélia CRM';
}

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const title = getTitle(location.pathname);

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />

      {location.pathname !== '/' && (
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <h1 className="text-base font-semibold truncate">{title}</h1>

      <div className="flex-1" />

      {/* Global Search */}
      <GlobalSearch />

      {/* Notifications */}
      <NotificationBell />

      {/* Theme toggle */}
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* Avatar */}
      <button onClick={() => navigate('/me')} className="shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(profile?.nome || null, profile?.email || '')}
          </AvatarFallback>
        </Avatar>
      </button>
    </header>
  );
}
