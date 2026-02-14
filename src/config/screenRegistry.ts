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
  ClipboardList,
  HeartPulse,
  Users,
  AlertCircle,
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
  { key: 'relatorios_executivo', label: 'Dashboard Executivo', group: 'Comercial', icon: BarChart3, url: '/relatorios/executivo' },
  { key: 'amelia', label: 'Amélia IA', group: 'Automação', icon: Bot, url: '/amelia' },
  { key: 'amelia_mass_action', label: 'Ação em Massa', group: 'Automação', icon: Bot, url: '/amelia/mass-action' },
  { key: 'cadencias', label: 'Cadências', group: 'Automação', icon: Zap, url: '/cadences' },
  { key: 'leads_cadencia', label: 'Leads em Cadência', group: 'Automação', icon: Play, url: '/cadences/runs' },
  { key: 'proximas_acoes', label: 'Próx. Ações', group: 'Automação', icon: Clock, url: '/cadences/next-actions' },
  { key: 'templates', label: 'Templates', group: 'Automação', icon: FileText, url: '/templates' },
  { key: 'capture_forms', label: 'Form de Captura', group: 'Automação', icon: ClipboardList, url: '/capture-forms' },
  { key: 'knowledge_base', label: 'Base de Conhecimento', group: 'Configuração', icon: BookOpen, url: '/admin/produtos' },
  { key: 'integracoes', label: 'Integrações', group: 'Configuração', icon: Plug, url: '/integracoes' },
  { key: 'benchmark_ia', label: 'Benchmark IA', group: 'Configuração', icon: FlaskConical, url: '/admin/ai-benchmark' },
  { key: 'monitor_sgt', label: 'Monitor SGT', group: 'Automação', icon: Activity, url: '/monitor/sgt-events' },
  { key: 'leads_quentes', label: 'Leads Quentes', group: 'Comercial', icon: Flame, url: '/admin/leads-quentes' },
  { key: 'importacao', label: 'Importação', group: 'Configuração', icon: Upload, url: '/importacao' },
  { key: 'telefonia_zadarma', label: 'Telefonia', group: 'Configuração', icon: PhoneCall, url: '/admin/zadarma' },
  { key: 'pendencias_gestor', label: 'Pendências', group: 'Principal', icon: AlertTriangle, url: '/pendencias' },
  { key: 'configuracoes', label: 'Configurações', group: 'Configuração', icon: Settings, url: '/admin/settings' },
  { key: 'cs_dashboard', label: 'Dashboard CS', group: 'Sucesso do Cliente', icon: HeartPulse, url: '/cs' },
  { key: 'cs_clientes', label: 'Clientes CS', group: 'Sucesso do Cliente', icon: Users, url: '/cs/clientes' },
  { key: 'cs_pesquisas', label: 'Pesquisas', group: 'Sucesso do Cliente', icon: ClipboardList, url: '/cs/pesquisas' },
  { key: 'cs_incidencias', label: 'Incidências', group: 'Sucesso do Cliente', icon: AlertCircle, url: '/cs/incidencias' },
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
