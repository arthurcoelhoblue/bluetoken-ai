// ========================================
// bluechat-inbound/payload-adapter.ts — Adapta payload nativo do Blue Chat
// ========================================

import { createLogger } from "../_shared/logger.ts";

const log = createLogger('bluechat-inbound/adapter');

/**
 * Formato nativo recebido do Blue Chat (evento ticket.assigned)
 */
interface BlueChatNativePayload {
  event: string;
  timestamp: string;
  ticket: {
    id: string;
    protocol?: string;
    status?: string;
    departmentId?: string;
    departmentName?: string;
  };
  contact: {
    id?: string;
    name?: string;
    phone: string;
    email?: string | null;
  };
  message?: {
    id?: string;
    content?: string;
    type?: string;
    mediaUrl?: string | null;
    timestamp?: string;
  };
  conversation?: Array<{
    role: string;
    content: string;
    type?: string;
    timestamp?: string;
  }>;
  summary?: string;
  instruction?: string;
}

/**
 * Verifica se o payload é no formato nativo do Blue Chat (tem "event" e "ticket")
 */
export function isNativeBlueChat(payload: Record<string, unknown>): boolean {
  return !!(payload.event && payload.ticket && payload.contact);
}

/**
 * Extrai a última mensagem do cliente da conversa
 */
function extractLastCustomerMessage(
  conversation?: BlueChatNativePayload['conversation'],
  summary?: string,
  instruction?: string,
): string {
  if (conversation && conversation.length > 0) {
    // Percorrer do fim para o início para encontrar a última mensagem do cliente
    for (let i = conversation.length - 1; i >= 0; i--) {
      const msg = conversation[i];
      if (msg.role === 'customer' && msg.content?.trim()) {
        return msg.content.trim();
      }
    }
    // Se não tem mensagem do cliente, pegar a última mensagem qualquer
    const lastMsg = conversation[conversation.length - 1];
    if (lastMsg?.content?.trim()) {
      return lastMsg.content.trim();
    }
  }

  // Fallback para summary ou instruction
  if (summary && typeof summary === 'string' && summary.trim()) {
    return summary.trim();
  }
  if (instruction && typeof instruction === 'string' && instruction.trim()) {
    return instruction.trim();
  }

  return '[Conversa sem mensagem de texto]';
}

/**
 * Concatena o histórico da conversa como contexto
 */
function buildConversationSummary(
  conversation?: BlueChatNativePayload['conversation'],
  summary?: string,
): string {
  const parts: string[] = [];

  if (summary && typeof summary === 'string') {
    parts.push(`Resumo: ${summary}`);
  }

  if (conversation && conversation.length > 0) {
    const history = conversation
      .filter(msg => msg.content?.trim())
      .map(msg => {
        const role = msg.role === 'customer' ? 'Cliente' : msg.role === 'agent' ? 'Atendente' : 'Sistema';
        return `${role}: ${msg.content.trim()}`;
      })
      .join('\n');

    if (history) {
      parts.push(`Histórico:\n${history}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Mapeia departmentName/departmentId para empresa
 */
function mapDepartmentToEmpresa(ticket: BlueChatNativePayload['ticket']): string | undefined {
  const dept = (ticket.departmentName || ticket.departmentId || '').toLowerCase();
  if (dept.includes('tokeniza')) return 'TOKENIZA';
  if (dept.includes('axia')) return 'AXIA';
  if (dept.includes('mpuppe') || dept.includes('puppe')) return 'MPUPPE';
  // Default: BLUE para comercial ou qualquer outro
  return 'BLUE';
}

/**
 * Transforma o payload nativo do Blue Chat no formato interno esperado
 */
export function adaptNativePayload(raw: Record<string, unknown>): Record<string, unknown> {
  const native = raw as unknown as BlueChatNativePayload;

  // Prioridade: message.content (mensagem atual) > conversation (histórico)
  const lastMessage = (native.message?.content?.trim())
    ? native.message.content.trim()
    : extractLastCustomerMessage(
        native.conversation,
        native.summary as string | undefined,
        native.instruction as string | undefined,
      );

  const conversationSummary = buildConversationSummary(
    native.conversation,
    native.summary as string | undefined,
  );

  const empresa = mapDepartmentToEmpresa(native.ticket);

  const adapted = {
    conversation_id: native.ticket.id,
    ticket_id: native.ticket.id,
    message_id: native.message?.id
      ? `bc-${native.message.id}`
      : `bc-${native.ticket.id}-${Date.now()}`,
    timestamp: native.timestamp,
    channel: 'WHATSAPP' as const,
    contact: {
      phone: native.contact.phone,
      name: native.contact.name || undefined,
      email: native.contact.email || undefined,
    },
    message: {
      type: 'text' as const,
      text: lastMessage,
    },
    context: {
      empresa,
      agent_id: 'amelia',
      tags: [native.event, native.ticket.status, native.ticket.departmentName].filter(Boolean) as string[],
      history_summary: conversationSummary,
    },
  };

  log.info('Payload adaptado', {
    event: native.event,
    ticketId: native.ticket.id,
    contactName: native.contact.name,
    messagePreview: lastMessage.substring(0, 80),
    empresa,
  });

  return adapted;
}
