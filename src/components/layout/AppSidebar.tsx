import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bot,
  CalendarCheck,
  Columns3,
  ContactRound,
  MessagesSquare,
  Target,
  RefreshCcw,
  Gauge,
  Zap,
  Play,
  Clock,
  FileText,
  BookOpen,
  Plug,
  FlaskConical,
  Activity,
  Flame,
  Settings,
  LogOut,
  ChevronRight,
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
import { CompanySwitcher } from './CompanySwitcher';
import type { UserRole } from '@/types/auth';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: UserRole[];
  liveDot?: boolean;
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
      { title: 'Meu Dia', url: '/', icon: CalendarCheck },
      { title: 'Pipeline', url: '/pipeline', icon: Columns3 },
      { title: 'Contatos', url: '/contatos', icon: ContactRound },
      { title: 'Conversas', url: '/conversas', icon: MessagesSquare },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { title: 'Metas & Comissões', url: '/metas', icon: Target },
      { title: 'Renovação', url: '/renovacao', icon: RefreshCcw },
      { title: 'Cockpit', url: '/cockpit', icon: Gauge, roles: ['ADMIN', 'CLOSER'] },
    ],
  },
  {
    label: 'Automação',
    items: [
      { title: 'Amélia IA', url: '/amelia', icon: Bot, roles: ['ADMIN'], liveDot: true },
      { title: 'Cadências', url: '/cadences', icon: Zap, roles: ['ADMIN', 'MARKETING'] },
      { title: 'Leads em Cadência', url: '/cadences/runs', icon: Play, roles: ['ADMIN', 'CLOSER', 'MARKETING'] },
      { title: 'Próx. Ações', url: '/cadences/next-actions', icon: Clock, roles: ['ADMIN', 'CLOSER'] },
      { title: 'Templates', url: '/templates', icon: FileText, roles: ['ADMIN', 'MARKETING'] },
    ],
  },
  {
    label: 'Configuração',
    items: [
      { title: 'Knowledge Base', url: '/admin/produtos', icon: BookOpen, roles: ['ADMIN'] },
      { title: 'Integrações', url: '/integracoes', icon: Plug, roles: ['ADMIN'] },
      { title: 'Benchmark IA', url: '/admin/ai-benchmark', icon: FlaskConical, roles: ['ADMIN'] },
      { title: 'Monitor SGT', url: '/monitor/sgt-events', icon: Activity, roles: ['ADMIN', 'AUDITOR'] },
      { title: 'Leads Quentes', url: '/admin/leads-quentes', icon: Flame, roles: ['ADMIN', 'CLOSER'] },
      { title: 'Configurações', url: '/admin/settings', icon: Settings, roles: ['ADMIN'] },
    ],
    roles: ['ADMIN', 'AUDITOR', 'CLOSER'],
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
    if (name) return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
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
              <span className="font-bold text-sm truncate">Blue CRM</span>
              <span className="text-xs text-muted-foreground truncate">Grupo Blue</span>
            </div>
          )}
        </div>
        <CompanySwitcher collapsed={collapsed} />
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
                        <button onClick={() => navigate(item.url)} className="relative">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          {item.liveDot && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-success animate-pulse" />
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer - User */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Meu Perfil">
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
            <SidebarMenuButton asChild tooltip="Sair">
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
