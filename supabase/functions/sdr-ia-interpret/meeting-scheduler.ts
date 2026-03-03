// ========================================
// MEETING SCHEDULER MODULE
// Handles the meeting scheduling flow within SDR conversations:
// 1. Proposes 3 time slots to the lead
// 2. Detects which slot was chosen
// 3. Books the meeting via calendar-book edge function
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('meeting-scheduler');

interface SchedulingContext {
  leadId: string;
  empresa: string;
  vendedorId: string;
  leadNome?: string;
  leadEmail?: string;
  leadTelefone?: string;
  dealId?: string;
  mensagem: string;
}

interface ProposalResult {
  success: boolean;
  resposta: string;
  schedulingStateId?: string;
}

// ========================================
// 1. PROPOSE MEETING SLOTS
// Called when CTA_REUNIAO is triggered or intent = AGENDAMENTO_REUNIAO
// ========================================

export async function proposeMeetingSlots(
  supabase: SupabaseClient,
  ctx: SchedulingContext
): Promise<ProposalResult> {
  try {
    // Check if there's already a pending scheduling state
    const { data: existingState } = await supabase
      .from('meeting_scheduling_state')
      .select('id, slots_propostos, tentativa_numero')
      .eq('lead_id', ctx.leadId)
      .eq('empresa', ctx.empresa)
      .eq('status', 'AGUARDANDO_RESPOSTA')
      .maybeSingle();

    if (existingState) {
      // Already proposed — check if lead is choosing
      const choiceResult = detectSlotChoice(ctx.mensagem, existingState.slots_propostos as SlotProposal[]);
      if (choiceResult.chosen !== null) {
        return await confirmSlotChoice(supabase, ctx, existingState.id, existingState.slots_propostos as SlotProposal[], choiceResult.chosen);
      }
      
      // Lead rejected or asked for other times
      if (choiceResult.rejected) {
        // Mark current as rejected
        await supabase.from('meeting_scheduling_state').update({
          status: 'REJEITADO',
          updated_at: new Date().toISOString(),
        }).eq('id', existingState.id);
        
        // Propose new slots (next attempt)
        return await fetchAndPropose(supabase, ctx, (existingState.tentativa_numero as number) + 1);
      }

      // Lead is asking something else — return the slots again
      const slots = existingState.slots_propostos as SlotProposal[];
      return {
        success: true,
        resposta: formatSlotsMessage(slots, ctx.leadNome),
      };
    }

    // First proposal
    return await fetchAndPropose(supabase, ctx, 1);
  } catch (error) {
    log.error('proposeMeetingSlots error', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      resposta: `${ctx.leadNome ? ctx.leadNome + ', p' : 'P'}osso agendar uma reunião com nosso especialista! Vou verificar a agenda e te passo os horários disponíveis em instantes. 😊`,
    };
  }
}

// ========================================
// 2. CHECK IF LEAD IS IN SCHEDULING FLOW
// ========================================

export async function checkSchedulingState(
  supabase: SupabaseClient,
  leadId: string,
  empresa: string
): Promise<{ active: boolean; stateId?: string; slots?: SlotProposal[] }> {
  const { data } = await supabase
    .from('meeting_scheduling_state')
    .select('id, slots_propostos')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .eq('status', 'AGUARDANDO_RESPOSTA')
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (data) {
    return { active: true, stateId: data.id, slots: data.slots_propostos as SlotProposal[] };
  }
  return { active: false };
}

// ========================================
// 3. HANDLE SCHEDULING RESPONSE
// Called when lead responds while in scheduling flow
// ========================================

export async function handleSchedulingResponse(
  supabase: SupabaseClient,
  ctx: SchedulingContext,
  stateId: string,
  slots: SlotProposal[]
): Promise<ProposalResult> {
  const choiceResult = detectSlotChoice(ctx.mensagem, slots);

  if (choiceResult.chosen !== null) {
    return await confirmSlotChoice(supabase, ctx, stateId, slots, choiceResult.chosen);
  }

  if (choiceResult.rejected) {
    // Mark as rejected and propose new slots
    await supabase.from('meeting_scheduling_state').update({
      status: 'REJEITADO',
      updated_at: new Date().toISOString(),
    }).eq('id', stateId);

    const { data: stateData } = await supabase
      .from('meeting_scheduling_state')
      .select('tentativa_numero')
      .eq('id', stateId)
      .single();

    return await fetchAndPropose(supabase, ctx, ((stateData?.tentativa_numero as number) || 1) + 1);
  }

  // Unclear response — ask again
  return {
    success: true,
    resposta: `${ctx.leadNome ? ctx.leadNome + ', ' : ''}qual dos horários funciona melhor pra você? Pode me dizer o número (1, 2 ou 3), ou se nenhum funcionar, posso sugerir outros! 😊`,
  };
}

// ========================================
// INTERNAL HELPERS
// ========================================

interface SlotProposal {
  inicio: string;
  fim: string;
  label: string;
}

async function fetchAndPropose(
  supabase: SupabaseClient,
  ctx: SchedulingContext,
  tentativa: number
): Promise<ProposalResult> {
  if (tentativa > 3) {
    return {
      success: true,
      resposta: `${ctx.leadNome ? ctx.leadNome + ', ' : ''}Não consegui encontrar um horário que funcione. Que tal me dizer um dia e horário que seria ideal pra você? Vou tentar encaixar na agenda! 😊`,
    };
  }

  // Call calendar-slots edge function
  const slotsResp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/calendar-slots`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vendedor_id: ctx.vendedorId,
      empresa: ctx.empresa,
      num_slots: 3,
    }),
  });

  if (!slotsResp.ok) {
    const err = await slotsResp.text();
    log.error('calendar-slots failed', { error: err });
    return {
      success: false,
      resposta: `${ctx.leadNome ? ctx.leadNome + ', ' : ''}Vou verificar a agenda do nosso especialista e te passo os horários disponíveis em breve! 😊`,
    };
  }

  const slotsData = await slotsResp.json();
  const slots: SlotProposal[] = slotsData.slots || [];

  if (slots.length === 0) {
    return {
      success: true,
      resposta: `${ctx.leadNome ? ctx.leadNome + ', ' : ''}No momento a agenda está bem cheia. Me diz um dia e horário que seria bom pra você que eu verifico se consigo encaixar! 😊`,
    };
  }

  // Save scheduling state
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h expiry
  
  // Delete any existing pending state first
  await supabase.from('meeting_scheduling_state')
    .delete()
    .eq('lead_id', ctx.leadId)
    .eq('empresa', ctx.empresa)
    .eq('status', 'AGUARDANDO_RESPOSTA');

  const { data: newState } = await supabase.from('meeting_scheduling_state').insert({
    lead_id: ctx.leadId,
    empresa: ctx.empresa,
    vendedor_id: ctx.vendedorId,
    deal_id: ctx.dealId || null,
    slots_propostos: slots,
    tentativa_numero: tentativa,
    status: 'AGUARDANDO_RESPOSTA',
    expires_at: expiresAt,
  }).select('id').single();

  const resposta = formatSlotsMessage(slots, ctx.leadNome, slotsData.vendedor_nome);

  return {
    success: true,
    resposta,
    schedulingStateId: newState?.id,
  };
}

function formatSlotsMessage(slots: SlotProposal[], leadNome?: string, vendedorNome?: string): string {
  const greeting = leadNome ? `${leadNome}, ` : '';
  const specialist = vendedorNome ? `com ${vendedorNome}` : 'com nosso especialista';
  
  let msg = `${greeting}tenho alguns horários disponíveis para uma reunião ${specialist}:\n\n`;
  
  slots.forEach((slot, i) => {
    msg += `*${i + 1}.* ${slot.label}\n`;
  });

  msg += `\nQual desses horários funciona melhor pra você? É só me dizer o número! 😊`;
  
  if (slots.length >= 3) {
    msg += `\nSe nenhum funcionar, posso sugerir outros horários.`;
  }

  return msg;
}

function detectSlotChoice(mensagem: string, slots: SlotProposal[]): { chosen: number | null; rejected: boolean } {
  const msg = mensagem.toLowerCase().trim();

  // Direct number choice: "1", "2", "3", "opção 1", "primeiro", etc.
  const numberPatterns: Record<string, number> = {
    '1': 0, 'um': 0, 'primeiro': 0, 'primeira': 0, 'opção 1': 0, 'opcao 1': 0,
    '2': 1, 'dois': 1, 'segundo': 1, 'segunda': 1, 'opção 2': 1, 'opcao 2': 1,
    '3': 2, 'três': 2, 'tres': 2, 'terceiro': 2, 'terceira': 2, 'opção 3': 2, 'opcao 3': 2,
  };

  for (const [pattern, index] of Object.entries(numberPatterns)) {
    if (msg === pattern || msg.startsWith(pattern + ' ') || msg.startsWith(pattern + ',') || msg.startsWith(pattern + '.') || msg.startsWith(pattern + '!')) {
      if (index < slots.length) return { chosen: index, rejected: false };
    }
  }

  // Check if message contains day/time from a specific slot
  for (let i = 0; i < slots.length; i++) {
    const label = slots[i].label.toLowerCase();
    // Extract key parts: day name and time
    const dayMatch = label.match(/(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)/);
    const timeMatch = label.match(/(\d{2}:\d{2})/);
    
    if (dayMatch && msg.includes(dayMatch[1])) {
      if (timeMatch && msg.includes(timeMatch[1])) {
        return { chosen: i, rejected: false };
      }
      // Day mentioned without time — if only one slot on that day, choose it
      const slotsOnDay = slots.filter(s => s.label.toLowerCase().includes(dayMatch[1]));
      if (slotsOnDay.length === 1) return { chosen: i, rejected: false };
    }
  }

  // Rejection patterns
  const rejectionPatterns = [
    'nenhum', 'nenhuma', 'não consigo', 'nao consigo', 'não posso', 'nao posso',
    'outro horário', 'outro horario', 'outros horários', 'outros horarios',
    'não dá', 'nao da', 'não serve', 'nao serve', 'difícil', 'dificil',
    'não funciona', 'nao funciona', 'impossível', 'impossivel',
  ];

  for (const pattern of rejectionPatterns) {
    if (msg.includes(pattern)) return { chosen: null, rejected: true };
  }

  // Positive but unclear
  const positivePatterns = ['sim', 'ok', 'pode ser', 'bora', 'vamos', 'fechado', 'combinado', 'perfeito', 'ótimo', 'otimo'];
  for (const pattern of positivePatterns) {
    if (msg === pattern || msg.startsWith(pattern + ' ') || msg.startsWith(pattern + '!') || msg.startsWith(pattern + ',')) {
      // If only one slot, assume they chose it
      if (slots.length === 1) return { chosen: 0, rejected: false };
      // Otherwise unclear
      return { chosen: null, rejected: false };
    }
  }

  return { chosen: null, rejected: false };
}

async function confirmSlotChoice(
  supabase: SupabaseClient,
  ctx: SchedulingContext,
  stateId: string,
  slots: SlotProposal[],
  chosenIndex: number
): Promise<ProposalResult> {
  const chosen = slots[chosenIndex];

  try {
    // Call calendar-book to create the event
    const bookResp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/calendar-book`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vendedor_id: ctx.vendedorId,
        empresa: ctx.empresa,
        lead_id: ctx.leadId,
        deal_id: ctx.dealId,
        convidado_nome: ctx.leadNome,
        convidado_email: ctx.leadEmail,
        convidado_telefone: ctx.leadTelefone,
        data_hora_inicio: chosen.inicio,
        data_hora_fim: chosen.fim,
      }),
    });

    if (!bookResp.ok) {
      const err = await bookResp.text();
      log.error('calendar-book failed', { error: err });
      throw new Error(err);
    }

    const bookData = await bookResp.json();

    // Update scheduling state
    await supabase.from('meeting_scheduling_state').update({
      status: 'ACEITO',
      slot_escolhido: chosenIndex,
      meeting_id: bookData.meeting_id,
      updated_at: new Date().toISOString(),
    }).eq('id', stateId);

    // Build confirmation message
    let resposta = `Perfeito${ctx.leadNome ? `, ${ctx.leadNome}` : ''}! Reunião agendada para *${chosen.label}*! ✅\n\n`;
    
    if (bookData.google_meet_link) {
      resposta += `📹 Link do Google Meet: ${bookData.google_meet_link}\n\n`;
    }

    if (ctx.leadEmail) {
      resposta += `Enviei um convite para ${ctx.leadEmail}. `;
    }

    resposta += `Nos vemos lá! Se precisar reagendar, é só me avisar. 😊`;

    return { success: true, resposta };
  } catch (error) {
    log.error('confirmSlotChoice error', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: true,
      resposta: `${ctx.leadNome ? ctx.leadNome + ', ' : ''}Ótima escolha! Estou confirmando o horário *${chosen.label}*. Em instantes te envio a confirmação com o link da reunião! 😊`,
    };
  }
}
