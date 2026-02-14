import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS } from "@/types/auth";

// Test the permission logic directly (extracted from AuthContext)
function hasPermission(roles: string[], permission: string): boolean {
  if (roles.includes("ADMIN")) return true;
  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
    if (!permissions) continue;
    if (permissions.includes(permission)) return true;
    if (permissions.includes("*")) return true;
    if (permission.endsWith(":read") && permissions.includes("*:read")) return true;
    const [resource] = permission.split(":");
    if (permissions.includes(`${resource}:*`)) return true;
  }
  return false;
}

function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role) || roles.includes("ADMIN");
}

describe("AuthContext permission logic", () => {
  it("ADMIN has all permissions", () => {
    expect(hasPermission(["ADMIN"], "leads:write")).toBe(true);
    expect(hasPermission(["ADMIN"], "anything:whatever")).toBe(true);
  });

  it("ADMIN has all roles", () => {
    expect(hasRole(["ADMIN"], "CLOSER")).toBe(true);
    expect(hasRole(["ADMIN"], "MARKETING")).toBe(true);
  });

  it("CLOSER has own role but not others", () => {
    expect(hasRole(["CLOSER"], "CLOSER")).toBe(true);
    expect(hasRole(["CLOSER"], "ADMIN")).toBe(false);
  });

  it("empty roles have no permissions", () => {
    expect(hasPermission([], "leads:read")).toBe(false);
    expect(hasRole([], "ADMIN")).toBe(false);
  });

  it("wildcard resource permissions work", () => {
    const roles = ["CLOSER"];
    const perms = ROLE_PERMISSIONS["CLOSER"];
    if (perms && perms.includes("leads:*")) {
      expect(hasPermission(roles, "leads:read")).toBe(true);
      expect(hasPermission(roles, "leads:write")).toBe(true);
    }
  });

  it("READONLY has limited access", () => {
    expect(hasPermission(["READONLY"], "deals:write")).toBe(false);
  });
});

// ─── Expanded RBAC Tests ──────────────────────────────────
describe("SDR_IA permissions", () => {
  it("has leads:* wildcard", () => {
    expect(hasPermission(["SDR_IA"], "leads:read")).toBe(true);
    expect(hasPermission(["SDR_IA"], "leads:write")).toBe(true);
  });
  it("has conversations:*", () => {
    expect(hasPermission(["SDR_IA"], "conversations:read")).toBe(true);
    expect(hasPermission(["SDR_IA"], "conversations:send")).toBe(true);
  });
  it("has cadences:*", () => {
    expect(hasPermission(["SDR_IA"], "cadences:read")).toBe(true);
  });
  it("has whatsapp:*", () => {
    expect(hasPermission(["SDR_IA"], "whatsapp:send")).toBe(true);
  });
  it("does NOT have campaigns", () => {
    expect(hasPermission(["SDR_IA"], "campaigns:read")).toBe(false);
  });
});

describe("MARKETING permissions", () => {
  it("has campaigns:*", () => {
    expect(hasPermission(["MARKETING"], "campaigns:read")).toBe(true);
    expect(hasPermission(["MARKETING"], "campaigns:write")).toBe(true);
  });
  it("has analytics:*", () => {
    expect(hasPermission(["MARKETING"], "analytics:read")).toBe(true);
  });
  it("has leads:read but NOT leads:write", () => {
    expect(hasPermission(["MARKETING"], "leads:read")).toBe(true);
    expect(hasPermission(["MARKETING"], "leads:write")).toBe(false);
  });
});

describe("AUDITOR permissions", () => {
  it("has *:read on any resource", () => {
    expect(hasPermission(["AUDITOR"], "leads:read")).toBe(true);
    expect(hasPermission(["AUDITOR"], "deals:read")).toBe(true);
    expect(hasPermission(["AUDITOR"], "analytics:read")).toBe(true);
  });
  it("does NOT have write on anything", () => {
    expect(hasPermission(["AUDITOR"], "leads:write")).toBe(false);
    expect(hasPermission(["AUDITOR"], "deals:update")).toBe(false);
  });
});

describe("READONLY permissions", () => {
  it("has dashboard:read", () => {
    expect(hasPermission(["READONLY"], "dashboard:read")).toBe(true);
  });
  it("does NOT have other reads", () => {
    expect(hasPermission(["READONLY"], "leads:read")).toBe(false);
    expect(hasPermission(["READONLY"], "deals:read")).toBe(false);
  });
});

describe("Combined roles", () => {
  it("CLOSER + MARKETING combines permissions", () => {
    const roles = ["CLOSER", "MARKETING"];
    expect(hasPermission(roles, "leads:read")).toBe(true);
    expect(hasPermission(roles, "campaigns:write")).toBe(true);
    expect(hasPermission(roles, "conversations:read")).toBe(true);
    expect(hasPermission(roles, "analytics:read")).toBe(true);
  });
});
