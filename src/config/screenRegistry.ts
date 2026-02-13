import {
  AlertTriangle,
  CalendarCheck,
  Columns3,
  ContactRound,
  MessagesSquare,
  Target,
  RefreshCcw,
  Gauge,
  Bot,
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
  BarChart3,
  Upload,
  PhoneCall,
} from 'lucide-react';

export interface ScreenRegistryItem {
  key: string;
  label: string;
  group: string;
  icon: React.ElementType;
  url: string;
}

export const SCREEN_REGISTRY: ScreenRegistryItem[] = [
  { key: 'dashboard', label: 'Meu Dia', group: 'Principal', icon: CalendarCheck, url: '/' },
  { key: 'pipeline', label: 'Pipeline', group: 'Principal', icon: Columns3, url: '/pipeline' },
  { key: 'contatos', label: 'Contatos', group: 'Principal', icon: ContactRound, url: '/contatos' },
  { key: 'conversas', label: 'Conversas', group: 'Principal', icon: MessagesSquare, url: '/conversas' },
  { key: 'metas', label: 'Metas & Comissões', group: 'Comercial', icon: Target, url: '/metas' },
  { key: 'renovacao', label: 'Renovação', group: 'Comercial', icon: RefreshCcw, url: '/renovacao' },
  { key: 'cockpit', label: 'Cockpit', group: 'Comercial', icon: Gauge, url: '/cockpit' },
  { key: 'relatorios', label: 'Relatórios', group: 'Comercial', icon: BarChart3, url: '/relatorios' },
  { key: 'amelia', label: 'Amélia IA', group: 'Automação', icon: Bot, url: '/amelia' },
  { key: 'amelia_mass_action', label: 'Ação em Massa', group: 'Automação', icon: Bot, url: '/amelia/mass-action' },
  { key: 'cadencias', label: 'Cadências', group: 'Automação', icon: Zap, url: '/cadences' },
  { key: 'cadencias_crm', label: 'Cadências CRM', group: 'Automação', icon: Zap, url: '/cadencias-crm' },
  { key: 'leads_cadencia', label: 'Leads em Cadência', group: 'Automação', icon: Play, url: '/cadences/runs' },
  { key: 'proximas_acoes', label: 'Próx. Ações', group: 'Automação', icon: Clock, url: '/cadences/next-actions' },
  { key: 'templates', label: 'Templates', group: 'Automação', icon: FileText, url: '/templates' },
  { key: 'knowledge_base', label: 'Knowledge Base', group: 'Configuração', icon: BookOpen, url: '/admin/produtos' },
  { key: 'integracoes', label: 'Integrações', group: 'Configuração', icon: Plug, url: '/integracoes' },
  { key: 'benchmark_ia', label: 'Benchmark IA', group: 'Configuração', icon: FlaskConical, url: '/admin/ai-benchmark' },
  { key: 'monitor_sgt', label: 'Monitor SGT', group: 'Configuração', icon: Activity, url: '/monitor/sgt-events' },
  { key: 'leads_quentes', label: 'Leads Quentes', group: 'Configuração', icon: Flame, url: '/admin/leads-quentes' },
  { key: 'importacao', label: 'Importação', group: 'Configuração', icon: Upload, url: '/importacao' },
  { key: 'telefonia_zadarma', label: 'Telefonia', group: 'Configuração', icon: PhoneCall, url: '/admin/zadarma' },
  { key: 'pendencias_gestor', label: 'Pendências', group: 'Principal', icon: AlertTriangle, url: '/pendencias' },
  { key: 'configuracoes', label: 'Configurações', group: 'Configuração', icon: Settings, url: '/admin/settings' },
];

export const SCREEN_GROUPS = [...new Set(SCREEN_REGISTRY.map(s => s.group))];

export function getScreensByGroup(): Record<string, ScreenRegistryItem[]> {
  return SCREEN_REGISTRY.reduce((acc, screen) => {
    if (!acc[screen.group]) acc[screen.group] = [];
    acc[screen.group].push(screen);
    return acc;
  }, {} as Record<string, ScreenRegistryItem[]>);
}

export function getScreenByUrl(url: string): ScreenRegistryItem | undefined {
  if (url === '/') return SCREEN_REGISTRY.find(s => s.key === 'dashboard');
  return SCREEN_REGISTRY.find(s => s.url !== '/' && url.startsWith(s.url));
}
