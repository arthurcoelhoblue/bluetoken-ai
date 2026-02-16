// ========================================
// Fase 4 — Testes de Isolamento para tenant.ts
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
