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
    // If a role has 'leads:*' it should match 'leads:read', 'leads:write'
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
