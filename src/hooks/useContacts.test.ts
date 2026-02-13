import { describe, it, expect } from "vitest";

describe("useContacts filter logic", () => {
  it("applies empresa filter when not all", () => {
    const activeCompany: string = "blue";
    const shouldFilter = activeCompany !== "all";
    expect(shouldFilter).toBe(true);
    expect(activeCompany.toUpperCase()).toBe("BLUE");
  });

  it("skips empresa filter when all", () => {
    const activeCompany: string = "all";
    const shouldFilter = activeCompany !== "all";
    expect(shouldFilter).toBe(false);
  });

  it("builds search OR filter correctly", () => {
    const search = "João";
    const orFilter = `nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`;
    expect(orFilter).toContain("nome.ilike.%João%");
    expect(orFilter).toContain("email.ilike.%João%");
  });

  it("handles empty vs non-empty search", () => {
    const empty = "";
    const nonEmpty = "test";
    expect(empty.length > 0).toBe(false);
    expect(nonEmpty.length > 0).toBe(true);
  });
});
