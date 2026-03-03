import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const { owner_id, deal_id, contact_id, empresa, titulo, descricao, start, end, attendee_email } = body;

    if (!owner_id || !start || !end || !empresa) {
      return json({ error: "owner_id, start, end, empresa obrigatórios" }, 400);
    }

    const supabase = createServiceClient();

    // Load tokens + config
    const [tokensRes, configRes] = await Promise.all([
      supabase.from("user_google_tokens").select("*").eq("user_id", owner_id).maybeSingle(),
      supabase.from("user_meeting_config").select("google_meet_enabled").eq("user_id", owner_id).maybeSingle(),
    ]);

    const tokens = tokensRes.data;
    const meetEnabled = configRes.data?.google_meet_enabled ?? true;

    let googleEventId: string | null = null;
    let meetLink: string | null = null;

    // Create Google Calendar event if connected
    if (tokens) {
      let accessToken = tokens.access_token;

      // Refresh if expired
      if (new Date(tokens.token_expiry) <= new Date() && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
        const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: tokens.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshResp.json();
        if (refreshResp.ok) {
          accessToken = refreshData.access_token;
          await supabase.from("user_google_tokens").update({
            access_token: refreshData.access_token,
            token_expiry: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
          }).eq("user_id", owner_id);
        }
      }

      // Build event
      const event: Record<string, unknown> = {
        summary: titulo || "Reunião agendada",
        description: descricao || "",
        start: { dateTime: start, timeZone: "America/Sao_Paulo" },
        end: { dateTime: end, timeZone: "America/Sao_Paulo" },
      };

      if (attendee_email) {
        event.attendees = [{ email: attendee_email }];
      }

      if (meetEnabled) {
        event.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }

      try {
        const calResp = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(event),
          }
        );

        if (calResp.ok) {
          const calData = await calResp.json();
          googleEventId = calData.id || null;
          meetLink = calData.hangoutLink || calData.conferenceData?.entryPoints?.[0]?.uri || null;
        } else {
          console.warn("Google Calendar API error:", await calResp.text());
        }
      } catch (e) {
        console.warn("Google Calendar event creation failed:", e);
      }
    }

    // Insert meeting in DB
    const { data: meeting, error: meetErr } = await supabase.from("meetings").insert({
      deal_id: deal_id || null,
      contact_id: contact_id || null,
      owner_id,
      empresa,
      titulo: titulo || "Reunião agendada",
      descricao: descricao || null,
      data_inicio: start,
      data_fim: end,
      google_event_id: googleEventId,
      google_meet_link: meetLink,
      status: "AGENDADA",
    }).select().single();

    if (meetErr) return json({ error: "Failed to create meeting", details: meetErr.message }, 500);

    // Create deal activity if deal_id is provided (using correct column names)
    if (deal_id) {
      await supabase.from("deal_activities").insert({
        deal_id,
        tipo: "REUNIAO",
        descricao: `Reunião agendada: ${titulo || "Reunião"} em ${new Date(start).toLocaleDateString("pt-BR")}`,
        metadata: {
          meeting_id: meeting.id,
          google_event_id: googleEventId,
          google_meet_link: meetLink,
          start,
          end,
        },
        user_id: owner_id,
      });
    }

    return json({
      success: true,
      meeting,
      google_event_id: googleEventId,
      google_meet_link: meetLink,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
