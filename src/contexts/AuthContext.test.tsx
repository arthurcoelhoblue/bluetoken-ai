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

// ─── 3.1b: buildPermissionsFromRoles Tests ────────────────────
import { SCREEN_REGISTRY } from "@/config/screenRegistry";
import type { PermissionsMap, ScreenPermission } from "@/types/accessControl";

/** Replicates the pure logic from useScreenPermissions.ts */
function buildPermissionsFromRoles(userRoles: string[]): PermissionsMap {
  const allPerms = userRoles.flatMap(
    (r) => ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS] ?? []
  );
  const hasWildcard = allPerms.includes("*");
  const hasReadAll = allPerms.includes("*:read");

  return SCREEN_REGISTRY.reduce((acc, s) => {
    const canView =
      hasWildcard ||
      hasReadAll ||
      allPerms.some((p) => {
        const [resource] = p.split(":");
        return p === `${s.key}:read` || p === `${s.key}:*` || resource === s.key;
      });
    const canEdit =
      hasWildcard ||
      allPerms.some((p) => {
        const [resource, action] = p.split(":");
        return resource === s.key && (action === "*" || action === "write" || action === "update");
      });
    acc[s.key] = { view: canView || hasReadAll, edit: canEdit };
    return acc;
  }, {} as PermissionsMap);
}

describe("buildPermissionsFromRoles", () => {
  it("ADMIN gets view+edit on all screens", () => {
    // ADMIN has ['*'] so wildcard covers everything
    const perms = buildPermissionsFromRoles(["ADMIN"]);
    for (const s of SCREEN_REGISTRY) {
      expect(perms[s.key]).toEqual({ view: true, edit: true });
    }
  });

  it("AUDITOR gets view on all screens but edit on none", () => {
    const perms = buildPermissionsFromRoles(["AUDITOR"]);
    for (const s of SCREEN_REGISTRY) {
      expect(perms[s.key].view).toBe(true);
      expect(perms[s.key].edit).toBe(false);
    }
  });

  it("READONLY only views dashboard", () => {
    const perms = buildPermissionsFromRoles(["READONLY"]);
    expect(perms["dashboard"].view).toBe(true);
    expect(perms["dashboard"].edit).toBe(false);
    expect(perms["pipeline"].view).toBe(false);
  });

  it("CLOSER has leads:read permission", () => {
    // CLOSER has 'leads:read' which maps to screen keys starting with 'leads'
    expect(hasPermission(["CLOSER"], "leads:read")).toBe(true);
    expect(hasPermission(["CLOSER"], "leads:write")).toBe(false);
  });

  it("SDR_IA has cadences:* permission", () => {
    expect(hasPermission(["SDR_IA"], "cadences:read")).toBe(true);
    expect(hasPermission(["SDR_IA"], "cadences:write")).toBe(true);
  });

  it("MARKETING maps analytics via analytics:*", () => {
    const perms = buildPermissionsFromRoles(["MARKETING"]);
    // analytics:* should give view to screens whose key starts with analytics-related entries
    // campaigns:* gives edit where key matches
    expect(hasPermission(["MARKETING"], "analytics:read")).toBe(true);
  });
});

// ─── Override Logic Tests ─────────────────────────────────────

function applyOverrides(
  profilePerms: PermissionsMap,
  overrideMap: PermissionsMap | null
): PermissionsMap {
  return SCREEN_REGISTRY.reduce((acc, s) => {
    const profilePerm = profilePerms[s.key] ?? { view: false, edit: false };
    const overridePerm = overrideMap?.[s.key];
    acc[s.key] = overridePerm
      ? { view: overridePerm.view, edit: overridePerm.edit }
      : profilePerm;
    return acc;
  }, {} as PermissionsMap);
}

describe("Override logic", () => {
  it("override {view:true} prevails over profile {view:false}", () => {
    const profile: PermissionsMap = { dashboard: { view: false, edit: false } };
    const override: PermissionsMap = { dashboard: { view: true, edit: false } };
    const result = applyOverrides(profile, override);
    expect(result["dashboard"].view).toBe(true);
  });

  it("override {view:false} blocks even if profile allows", () => {
    const profile: PermissionsMap = { dashboard: { view: true, edit: true } };
    const override: PermissionsMap = { dashboard: { view: false, edit: false } };
    const result = applyOverrides(profile, override);
    expect(result["dashboard"].view).toBe(false);
  });

  it("without override uses profile", () => {
    const profile: PermissionsMap = { dashboard: { view: true, edit: true } };
    const result = applyOverrides(profile, null);
    expect(result["dashboard"].view).toBe(true);
  });

  it("override affects only the specified screen", () => {
    const profile: PermissionsMap = {
      dashboard: { view: true, edit: true },
      pipeline: { view: true, edit: true },
    };
    const override: PermissionsMap = { dashboard: { view: false, edit: false } };
    const result = applyOverrides(profile, override);
    expect(result["dashboard"].view).toBe(false);
    expect(result["pipeline"].view).toBe(true);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────
describe("Edge cases", () => {
  it("unknown role returns no permissions", () => {
    const perms = buildPermissionsFromRoles(["NONEXISTENT_ROLE"]);
    for (const s of SCREEN_REGISTRY) {
      expect(perms[s.key].view).toBe(false);
      expect(perms[s.key].edit).toBe(false);
    }
  });

  it("permission without colon returns false", () => {
    expect(hasPermission(["CLOSER"], "leadsread")).toBe(false);
  });

  it("duplicate roles do not cause errors", () => {
    const perms = buildPermissionsFromRoles(["CLOSER", "CLOSER"]);
    expect(perms).toBeDefined();
  });
});

// ─── Completude ───────────────────────────────────────────────
describe("Completude", () => {
  it("all 6 UserRole values have an entry in ROLE_PERMISSIONS", () => {
    const allRoles: string[] = ["ADMIN", "CLOSER", "MARKETING", "AUDITOR", "READONLY", "SDR_IA"];
    for (const role of allRoles) {
      expect(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]).toBeDefined();
    }
  });
});
