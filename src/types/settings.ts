export interface SystemSetting {
  id: string;
  category: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface HorarioFuncionamento {
  inicio: string;
  fim: string;
  dias: string[];
}

export interface LimitesMensagens {
  max_por_dia: number;
  intervalo_minutos: number;
}

export interface ComportamentoAmelia {
  tom: 'profissional' | 'informal' | 'formal';
  auto_escalar_apos: number;
  qualificacao_automatica: boolean;
}

export interface IntegrationConfig {
  enabled: boolean;
  provider?: string;
  sync_interval_minutes?: number;
}

export interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  secrets: string[];
  settingsKey: string;
}

export const INTEGRATIONS: IntegrationInfo[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Envio e recebimento de mensagens via WhatsApp',
    icon: 'MessageCircle',
    secrets: ['WHATSAPP_API_KEY', 'WHATSAPP_INBOUND_SECRET'],
    settingsKey: 'whatsapp',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Sincronização de deals e contatos com CRM',
    icon: 'BarChart3',
    secrets: ['PIPEDRIVE_API_TOKEN'],
    settingsKey: 'pipedrive',
  },
  {
    id: 'email',
    name: 'Email (SMTP)',
    description: 'Envio de emails transacionais',
    icon: 'Mail',
    secrets: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
    settingsKey: 'email',
  },
  {
    id: 'anthropic',
    name: 'IA Anthropic',
    description: 'Modelo Claude para a Amélia',
    icon: 'Brain',
    secrets: ['ANTHROPIC_API_KEY'],
    settingsKey: 'anthropic',
  },
  {
    id: 'sgt',
    name: 'SGT Webhook',
    description: 'Integração com Sistema de Gestão Tributária',
    icon: 'Webhook',
    secrets: ['SGT_WEBHOOK_SECRET'],
    settingsKey: 'sgt',
  },
  {
    id: 'mensageria',
    name: 'Mensageria',
    description: 'Infraestrutura de envio de mensagens',
    icon: 'Send',
    secrets: ['MENSAGERIA_API_KEY'],
    settingsKey: 'mensageria',
  },
  {
    id: 'bluechat',
    name: 'Blue Chat',
    description: 'Interface de atendimento humano',
    icon: 'Headphones',
    secrets: ['BLUECHAT_API_KEY'],
    settingsKey: 'bluechat',
  },
];

export interface WebhookInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  method: 'POST' | 'GET';
  authType: 'Bearer' | 'API-Key' | 'None';
  secretName?: string;
}

export const WEBHOOKS: WebhookInfo[] = [
  {
    id: 'whatsapp-inbound',
    name: 'WhatsApp Inbound',
    description: 'Recebe mensagens de leads via WhatsApp',
    path: '/functions/v1/whatsapp-inbound',
    method: 'POST',
    authType: 'Bearer',
    secretName: 'WHATSAPP_INBOUND_SECRET',
  },
  {
    id: 'bluechat-inbound',
    name: 'Blue Chat Inbound',
    description: 'Recebe mensagens do Blue Chat',
    path: '/functions/v1/bluechat-inbound',
    method: 'POST',
    authType: 'API-Key',
    secretName: 'BLUECHAT_API_KEY',
  },
  {
    id: 'sgt-webhook',
    name: 'SGT Webhook',
    description: 'Recebe eventos do Sistema de Gestão Tributária',
    path: '/functions/v1/sgt-webhook',
    method: 'POST',
    authType: 'Bearer',
    secretName: 'SGT_WEBHOOK_SECRET',
  },
  {
    id: 'pipedrive-sync',
    name: 'Pipedrive Sync',
    description: 'Sincronização com Pipedrive',
    path: '/functions/v1/pipedrive-sync',
    method: 'POST',
    authType: 'Bearer',
    secretName: 'PIPEDRIVE_API_TOKEN',
  },
  {
    id: 'cadence-runner',
    name: 'Cadence Runner',
    description: 'Executa cadências programadas',
    path: '/functions/v1/cadence-runner',
    method: 'POST',
    authType: 'None',
  },
];
