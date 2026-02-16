// ========================================
// Fase 4+5 — Testes de Isolamento para tenant.ts
// ========================================

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertEmpresa } from "./tenant.ts";

// ─── assertEmpresa ─────────────────────────────────

Deno.test("assertEmpresa aceita 'BLUE'", () => {
  assertEmpresa("BLUE");
});

Deno.test("assertEmpresa aceita 'TOKENIZA'", () => {
  assertEmpresa("TOKENIZA");
});

Deno.test("assertEmpresa rejeita string vazia", () => {
  assertThrows(() => assertEmpresa(""), Error, "Tenant inválido");
});

Deno.test("assertEmpresa rejeita valor minúsculo", () => {
  assertThrows(() => assertEmpresa("blue"), Error, "Tenant inválido");
});

Deno.test("assertEmpresa rejeita null", () => {
  assertThrows(() => assertEmpresa(null), Error, "Tenant inválido");
});

Deno.test("assertEmpresa rejeita undefined", () => {
  assertThrows(() => assertEmpresa(undefined), Error, "Tenant inválido");
});

Deno.test("assertEmpresa rejeita número", () => {
  assertThrows(() => assertEmpresa(123), Error, "Tenant inválido");
});

Deno.test("assertEmpresa rejeita tenant inexistente", () => {
  assertThrows(() => assertEmpresa("ACME"), Error, "Tenant inválido");
});

// ─── Edge Function validation (via HTTP) ─────────────────────────────────

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

// --- Existing tests (Fase 2) ---

Deno.test({ name: "deal-loss-analysis portfolio sem empresa retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/deal-loss-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ mode: "portfolio" }),
  });
  await res.text();
  assertEquals(res.status, 500);
}});

Deno.test({ name: "follow-up-scheduler sem empresa retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/follow-up-scheduler`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({}),
  });
  await res.text();
  assertEquals(res.status, 500);
}});

Deno.test({ name: "deal-loss-analysis com empresa inválida retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/deal-loss-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ mode: "portfolio", empresa: "ACME" }),
  });
  await res.text();
  assertEquals(res.status, 500);
}});

Deno.test({ name: "follow-up-scheduler com empresa inválida retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/follow-up-scheduler`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ empresa: "ACME" }),
  });
  await res.text();
  assertEquals(res.status, 500);
}});

// --- Fase 5: Testes expandidos para Grupo A ---

// next-best-action: sem empresa
Deno.test({ name: "next-best-action sem empresa retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/next-best-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000" }),
  });
  await res.text();
  assertEquals(res.status, 500);
}});

// next-best-action: empresa inválida
Deno.test({ name: "next-best-action com empresa inválida retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/next-best-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000", empresa: "ACME" }),
  });
  await res.text();
  assertEquals(res.status, 500);
}});

// amelia-mass-action: sem empresa
Deno.test({ name: "amelia-mass-action sem empresa retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/amelia-mass-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ job_id: "00000000-0000-0000-0000-000000000000" }),
  });
  await res.text();
  // May return 400 or 500 depending on job lookup
  const valid = res.status >= 400;
  assertEquals(valid, true);
}});

// amelia-mass-action: empresa inválida (via body fallback)
Deno.test({ name: "amelia-mass-action com empresa inválida retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/amelia-mass-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ job_id: "00000000-0000-0000-0000-000000000000", empresa: "ACME" }),
  });
  await res.text();
  const valid = res.status >= 400;
  assertEquals(valid, true);
}});

// cs-suggest-note: sem customer/empresa
Deno.test({ name: "cs-suggest-note sem customer retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cs-suggest-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({}),
  });
  await res.text();
  assertEquals(res.status, 500);
}});

// cs-suggest-note: empresa inválida
Deno.test({ name: "cs-suggest-note com empresa inválida retorna erro", ignore: !SUPABASE_URL, fn: async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cs-suggest-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ customer_id: "00000000-0000-0000-0000-000000000000", empresa: "ACME" }),
  });
  await res.text();
  assertEquals(res.status, 500);
}});
