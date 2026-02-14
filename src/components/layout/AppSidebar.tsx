import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  Columns3,
  ContactRound,
  MessagesSquare,
  Target,
  Kanban,
  SlidersHorizontal,
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
  ChevronDown,
  Upload,
  PhoneCall,
  ClipboardList,
  HeartPulse,
  Users,
  AlertCircle,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { CompanySwitcher } from './CompanySwitcher';
import { useScreenPermissions } from '@/hooks/useScreenPermissions';
import type { UserRole } from '@/types/auth';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  screenKey?: string;
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
      { title: 'Meu Dia', url: '/meu-dia', icon: CalendarCheck, screenKey: 'dashboard' },
      { title: 'Pipeline', url: '/pipeline', icon: Columns3, screenKey: 'pipeline' },
      { title: 'Contatos', url: '/contatos', icon: ContactRound, screenKey: 'contatos' },
      { title: 'Organizações', url: '/organizacoes', icon: Building2, screenKey: 'organizacoes' },
      { title: 'Conversas', url: '/conversas', icon: MessagesSquare, screenKey: 'conversas' },
      { title: 'Pendências', url: '/pendencias', icon: AlertTriangle, screenKey: 'pendencias_gestor' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { title: 'Metas & Comissões', url: '/metas', icon: Target, screenKey: 'metas' },
      { title: 'Renovação', url: '/renovacao', icon: RefreshCcw, screenKey: 'renovacao' },
      { title: 'Cockpit', url: '/cockpit', icon: Gauge, screenKey: 'cockpit' },
      { title: 'Relatórios', url: '/relatorios', icon: BarChart3, screenKey: 'relatorios' },
      { title: 'Leads Quentes', url: '/admin/leads-quentes', icon: Flame, screenKey: 'leads_quentes' },
    ],
  },
  {
    label: 'Automação',
    items: [
      { title: 'Amélia IA', url: '/amelia', icon: Bot, screenKey: 'amelia', liveDot: true },
      { title: 'Ação em Massa', url: '/amelia/mass-action', icon: Bot, screenKey: 'amelia_mass_action' },
      { title: 'Cadências', url: '/cadences', icon: Zap, screenKey: 'cadencias' },
      { title: 'Leads em Cadência', url: '/cadences/runs', icon: Play, screenKey: 'leads_cadencia' },
      { title: 'Próx. Ações', url: '/cadences/next-actions', icon: Clock, screenKey: 'proximas_acoes' },
      { title: 'Templates', url: '/templates', icon: FileText, screenKey: 'templates' },
      { title: 'Form de Captura', url: '/capture-forms', icon: ClipboardList, screenKey: 'capture_forms' },
      { title: 'Monitor SGT', url: '/monitor/sgt-events', icon: Activity, screenKey: 'monitor_sgt' },
    ],
  },
  {
    label: 'Sucesso do Cliente',
    items: [
      { title: 'Dashboard CS', url: '/cs', icon: HeartPulse, screenKey: 'cs_dashboard' },
      { title: 'Clientes CS', url: '/cs/clientes', icon: Users, screenKey: 'cs_clientes' },
      { title: 'Pesquisas', url: '/cs/pesquisas', icon: ClipboardList, screenKey: 'cs_pesquisas' },
      { title: 'Incidências', url: '/cs/incidencias', icon: AlertCircle, screenKey: 'cs_incidencias' },
      { title: 'Playbooks', url: '/cs/playbooks', icon: BookOpen, screenKey: 'cs_playbooks' },
    ],
  },
  {
    label: 'Configuração',
    items: [
      { title: 'Knowledge Base', url: '/admin/produtos', icon: BookOpen, screenKey: 'knowledge_base' },
      { title: 'Integrações', url: '/integracoes', icon: Plug, screenKey: 'integracoes' },
      { title: 'Benchmark IA', url: '/admin/ai-benchmark', icon: FlaskConical, screenKey: 'benchmark_ia' },
      
      { title: 'Funis', url: '/settings/pipelines', icon: Kanban, screenKey: 'funis_config' },
      { title: 'Campos', url: '/settings/custom-fields', icon: SlidersHorizontal, screenKey: 'campos_config' },
      { title: 'Importação', url: '/importacao', icon: Upload, screenKey: 'importacao' },
      { title: 'Telefonia', url: '/admin/zadarma', icon: PhoneCall, screenKey: 'telefonia_zadarma' },
      { title: 'Configurações', url: '/admin/settings', icon: Settings, screenKey: 'configuracoes' },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();
  const { data: permissions } = useScreenPermissions();
  const collapsed = state === 'collapsed';
  const isAdmin = roles.includes('ADMIN');

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const hasAccess = (item: NavItem) => {
    if (isAdmin) return true;
    // New permission system
    if (permissions && item.screenKey) {
      return permissions[item.screenKey]?.view ?? false;
    }
    // Legacy fallback
    if (item.roles && item.roles.length > 0) {
      return roles.some(role => item.roles!.includes(role));
    }
    return true;
  };

  const hasGroupAccess = (group: NavGroup) => {
    if (isAdmin) return true;
    if (group.roles && group.roles.length > 0 && !roles.some(r => group.roles!.includes(r))) {
      // Check if at least one item is visible
    }
    return group.items.some(item => hasAccess(item));
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
      <SidebarHeader className="border-b border-sidebar-border pb-4">
        <div className="flex items-center gap-3 px-2 py-3">
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
        <div className="px-2 mt-2">
          <CompanySwitcher collapsed={collapsed} />
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="pt-2">
        {navGroups.map((group) => {
          if (!hasGroupAccess(group)) return null;
          const visibleItems = group.items.filter(item => hasAccess(item));
          if (visibleItems.length === 0) return null;

          const groupHasActiveRoute = visibleItems.some(item => isActive(item.url));

          if (collapsed) {
            return (
              <SidebarGroup key={group.label}>
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
          }

          return (
            <Collapsible key={group.label} defaultOpen={groupHasActiveRoute} className="group/collapsible">
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors select-none">
                    <span className="flex-1">{group.label}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
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
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      {/* Footer - User */}
      <SidebarFooter className="border-t border-sidebar-border pt-3 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Meu Perfil" className="h-auto py-3">
              <button onClick={() => navigate('/me')} className="w-full">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(profile?.nome || null, profile?.email || '')}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex flex-col overflow-hidden flex-1 gap-2 ml-1">
                    <span className="text-sm font-semibold truncate leading-none">{profile?.nome || 'Usuário'}</span>
                    <div className="flex gap-1.5">
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
          <SidebarSeparator className="my-2" />
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
