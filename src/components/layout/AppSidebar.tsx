import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bot,
  Home,
  Users,
  Zap,
  Play,
  Clock,
  Activity,
  Settings,
  User,
  LogOut,
  ChevronRight,
  PlusCircle,
  Coins,
  BookOpen,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RoleBadge } from '@/components/auth/RoleBadge';
import type { UserRole } from '@/types/auth';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: UserRole[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Dashboard', url: '/', icon: Home },
      { title: 'Leads', url: '/leads', icon: Users },
    ],
  },
  {
    label: 'Cadências',
    items: [
      { title: 'Cadências', url: '/cadences', icon: Zap, roles: ['ADMIN', 'MARKETING'] },
      { title: 'Leads em Cadência', url: '/cadences/runs', icon: Play, roles: ['ADMIN', 'CLOSER', 'MARKETING'] },
      { title: 'Próximas Ações', url: '/cadences/next-actions', icon: Clock, roles: ['ADMIN', 'CLOSER'] },
    ],
  },
  {
    label: 'Monitoramento',
    items: [
      { title: 'Eventos SGT', url: '/monitor/sgt-events', icon: Activity, roles: ['ADMIN', 'AUDITOR'] },
    ],
    roles: ['ADMIN', 'AUDITOR'],
  },
  {
    label: 'Tokeniza',
    items: [
      { title: 'Ofertas', url: '/tokeniza/offers', icon: Coins },
    ],
  },
  {
    label: 'Administração',
    items: [
      { title: 'Treinamento Produtos', url: '/admin/produtos', icon: BookOpen, roles: ['ADMIN'] },
      { title: 'Configurações', url: '/admin/settings', icon: Settings, roles: ['ADMIN'] },
    ],
    roles: ['ADMIN'],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const hasAccess = (itemRoles?: UserRole[]) => {
    if (!itemRoles || itemRoles.length === 0) return true;
    return roles.some(role => itemRoles.includes(role));
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-sm truncate">SDR IA</span>
              <span className="text-xs text-muted-foreground truncate">Tokeniza & Blue</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {navGroups.map((group) => {
          if (!hasAccess(group.roles)) return null;
          
          const visibleItems = group.items.filter(item => hasAccess(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                      >
                        <button onClick={() => navigate(item.url)}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Quick Actions for Admin */}
        {roles.includes('ADMIN') && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Ações Rápidas</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Nova Cadência"
                    >
                      <button onClick={() => navigate('/cadences/new')}>
                        <PlusCircle className="h-4 w-4" />
                        <span>Nova Cadência</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer - User */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Meu Perfil"
            >
              <button onClick={() => navigate('/me')} className="w-full">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(profile?.nome || null, profile?.email || '')}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex flex-col overflow-hidden flex-1">
                    <span className="text-sm font-medium truncate">{profile?.nome || 'Usuário'}</span>
                    <div className="flex gap-1">
                      {roles.slice(0, 2).map(role => (
                        <RoleBadge key={role} role={role} size="sm" />
                      ))}
                    </div>
                  </div>
                )}
                {!collapsed && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Sair"
            >
              <button onClick={handleSignOut} className="text-destructive hover:text-destructive">
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
