// ========================================
// MEETING SCHEDULER MODULE — Handles meeting scheduling flow within SDR
// Integrated into sdr-ia-interpret pipeline
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { envConfig } from "../_shared/config.ts";

const log = createLogger("meeting-scheduler");

export interface MeetingSchedulerContext {
  leadId: string;
  empresa: string;
  contactId?: string;
  dealId?: string; // Internal UUID deal ID (NOT pipedrive ID)
  ownerId?: string;
  mensagem: string;
  telefone?: string;
  leadEmail?: string;
  leadNome?: string;
  empresaNome?: string;
}

export interface MeetingSchedulerResult {
  handled: boolean;
  response?: string;
  action?: string;
}

/**
 * Check if there's an active scheduling flow for this lead.
 * If so, handle the slot selection. If not, check if intent warrants starting one.
 */
export async function handleMeetingScheduling(
  supabase: SupabaseClient,
  ctx: MeetingSchedulerContext
): Promise<MeetingSchedulerResult> {
  try {
    // Check for active PENDENTE scheduling state
    const { data: pendingState } = await supabase
      .from("meeting_scheduling_state")
      .select("*")
      .eq("lead_id", ctx.leadId)
      .eq("empresa", ctx.empresa)
      .eq("status", "PENDENTE")
      .maybeSingle();

    if (pendingState) {
      // Handle AGUARDANDO_EMAIL state — lead needs to provide email
      if (pendingState.status === 'PENDENTE' && pendingState.slot_pre_selecionado) {
        // Check if message contains an email
        const emailMatch = ctx.mensagem.trim().match(/[\w.+-]+@[\w.-]+\.\w{2,}/i);
        if (emailMatch) {
          const email = emailMatch[0];
          ctx.leadEmail = email;
          return await completeBookingWithEmail(supabase, ctx, pendingState, email);
        }
        return { handled: true, response: "Preciso do seu e-mail para enviar o convite da reunião. Pode me informar? 📧" };
      }

      if (pendingState.slots_oferecidos) {
        return await handleSlotSelection(supabase, ctx, pendingState);
      }
    }

    return { handled: false };
  } catch (err) {
    log.error("Meeting scheduler error", { error: err instanceof Error ? err.message : String(err) });
    return { handled: false };
  }
}

/**
 * Start a new scheduling flow: fetch slots and offer to lead.
 */
export async function startMeetingScheduling(
  supabase: SupabaseClient,
  ctx: MeetingSchedulerContext
): Promise<MeetingSchedulerResult> {
  try {
    if (!ctx.ownerId) {
      log.warn("No owner_id for meeting scheduling", { leadId: ctx.leadId });
      return { handled: false };
    }

    // Fetch available slots via calendar-slots edge function
    const slotsResp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/calendar-slots`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ owner_id: ctx.ownerId, num_slots: 3 }),
    });

    if (!slotsResp.ok) {
      let errorBody = '';
      try { errorBody = await slotsResp.text(); } catch {}
      log.warn("Failed to fetch slots", { status: slotsResp.status, body: errorBody });
      return { handled: false };
    }

    const slotsData = await slotsResp.json();
    const slots = slotsData.slots || [];

    if (slots.length === 0) {
      return {
        handled: true,
        response: "No momento não temos horários disponíveis para reunião. Vou pedir para alguém da equipe entrar em contato com você para agendarmos. 😊",
        action: "ESCALAR_HUMANO",
      };
    }

    // Create scheduling state
    await supabase.from("meeting_scheduling_state").insert({
      lead_id: ctx.leadId,
      empresa: ctx.empresa,
      deal_id: ctx.dealId || null,
      contact_id: ctx.contactId || null,
      owner_id: ctx.ownerId,
      status: "PENDENTE",
      slots_oferecidos: slots,
    });

    // Build response with slot options
    const slotLabels = slots.map((s: { id: number; label: string }) => `${s.id}️⃣ ${s.label}`).join("\n");
    const response = `Ótimo! Tenho esses horários disponíveis para reunião:\n\n${slotLabels}\n\nQual horário fica melhor pra você? Responda com o número. 😊`;

    return { handled: true, response };
  } catch (err) {
    log.error("Start scheduling error", { error: err instanceof Error ? err.message : String(err) });
    return { handled: false };
  }
}

async function handleSlotSelection(
  supabase: SupabaseClient,
  ctx: MeetingSchedulerContext,
  state: Record<string, unknown>
): Promise<MeetingSchedulerResult> {
  const msg = ctx.mensagem.trim();
  const slots = state.slots_oferecidos as Array<{ id: number; start: string; end: string; label: string }>;

  // Try to match number
  const numMatch = msg.match(/^[1-3]$/);
  if (!numMatch) {
    // Check if they want to cancel
    if (/cancel|não|nao|desist/i.test(msg)) {
      await supabase.from("meeting_scheduling_state")
        .update({ status: "CANCELADO" })
        .eq("id", state.id as string);
      return { handled: true, response: "Ok, cancelei o agendamento. Se mudar de ideia, é só falar! 😊" };
    }

    const slotLabels = slots.map(s => `${s.id}️⃣ ${s.label}`).join("\n");
    return {
      handled: true,
      response: `Por favor, responda com o número do horário desejado:\n\n${slotLabels}`,
    };
  }

  const slotNum = parseInt(numMatch[0]);
  const chosen = slots.find(s => s.id === slotNum);
  if (!chosen) {
    return { handled: true, response: "Número inválido. Por favor, escolha 1, 2 ou 3." };
  }

  // If no email, save slot and ask for email
  if (!ctx.leadEmail) {
    await supabase.from("meeting_scheduling_state")
      .update({ slot_pre_selecionado: chosen })
      .eq("id", state.id as string);
    return {
      handled: true,
      response: `Ótima escolha! Para enviar o convite da reunião, preciso do seu e-mail. Pode me informar? 📧`,
    };
  }

  // Book the meeting
  return await bookMeeting(supabase, ctx, state, chosen);
}

const EMPRESA_DISPLAY: Record<string, string> = {
  BLUE: "Blue Consult",
  BLUE_LABS: "Blue Labs",
  TOKENIZA: "Tokeniza",
  MPUPPE: "MPuppe",
  AXIA: "Axia",
};

function buildMeetingTitle(ctx: MeetingSchedulerContext): string {
  const empresaDisplay = EMPRESA_DISPLAY[ctx.empresa] || ctx.empresa;
  const parts: string[] = ["Reunião", empresaDisplay];
  if (ctx.leadNome) {
    parts.push("-");
    parts.push(ctx.leadNome);
  }
  return parts.join(" ");
}

async function completeBookingWithEmail(
  supabase: SupabaseClient,
  ctx: MeetingSchedulerContext,
  state: Record<string, unknown>,
  email: string
): Promise<MeetingSchedulerResult> {
  const chosen = state.slot_pre_selecionado as { id: number; start: string; end: string; label: string };
  if (!chosen) {
    return { handled: true, response: "Houve um erro interno. Vamos recomeçar o agendamento?" };
  }
  ctx.leadEmail = email;
  return await bookMeeting(supabase, ctx, state, chosen);
}

async function bookMeeting(
  supabase: SupabaseClient,
  ctx: MeetingSchedulerContext,
  state: Record<string, unknown>,
  chosen: { id: number; start: string; end: string; label: string }
): Promise<MeetingSchedulerResult> {
  const titulo = buildMeetingTitle(ctx);

  const bookResp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/calendar-book`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      owner_id: state.owner_id,
      deal_id: ctx.dealId || state.deal_id || null,
      contact_id: ctx.contactId || state.contact_id || null,
      empresa: ctx.empresa,
      titulo,
      start: chosen.start,
      end: chosen.end,
      attendee_email: ctx.leadEmail || null,
    }),
  });

  if (!bookResp.ok) {
    log.error("Booking failed", { status: bookResp.status });
    return { handled: true, response: "Desculpe, houve um erro ao agendar. Vou pedir para alguém da equipe te ajudar! 😊" };
  }

  const bookData = await bookResp.json();

  // Update scheduling state
  await supabase.from("meeting_scheduling_state")
    .update({
      status: "ACEITO",
      slot_escolhido: chosen,
      slot_pre_selecionado: null,
      meeting_id: bookData.meeting?.id || null,
    })
    .eq("id", state.id as string);

  let response = `Perfeito! Reunião agendada para ${chosen.label}. ✅`;
  if (bookData.google_meet_link) {
    response += `\n\nLink do Google Meet: ${bookData.google_meet_link}`;
  }
  response += "\n\nTe esperamos lá! 😊";

  return { handled: true, response };
}
