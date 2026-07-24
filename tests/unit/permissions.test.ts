import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  roleHasPermission,
} from "@/server/auth/permissions";

describe("Berechtigungsmatrix", () => {
  it("Owner darf Billing verwalten, Admin nicht", () => {
    expect(roleHasPermission("owner", "billing", "manage")).toBe(true);
    expect(roleHasPermission("admin", "billing", "manage")).toBe(false);
    expect(roleHasPermission("admin", "billing", "view")).toBe(true);
  });

  it("BillingAdmin hat keinen Zugriff auf operative Daten", () => {
    expect(roleHasPermission("billingAdmin", "billing", "manage")).toBe(true);
    expect(roleHasPermission("billingAdmin", "agents", "view")).toBe(false);
    expect(roleHasPermission("billingAdmin", "knowledge", "view")).toBe(false);
    expect(roleHasPermission("billingAdmin", "approvals", "view")).toBe(false);
  });

  it("Viewer ist ausschließlich lesend", () => {
    expect(roleHasPermission("viewer", "agents", "view")).toBe(true);
    expect(roleHasPermission("viewer", "agents", "configure")).toBe(false);
    expect(roleHasPermission("viewer", "approvals", "decide")).toBe(false);
    expect(roleHasPermission("viewer", "tasks", "manage")).toBe(false);
    expect(roleHasPermission("viewer", "knowledge", "upload")).toBe(false);
  });

  it("Manager entscheidet Freigaben und konfiguriert Agenten, aktiviert aber nicht", () => {
    expect(roleHasPermission("manager", "approvals", "decide")).toBe(true);
    expect(roleHasPermission("manager", "agents", "configure")).toBe(true);
    expect(roleHasPermission("manager", "agents", "activate")).toBe(false);
    expect(roleHasPermission("manager", "integrations", "manage")).toBe(false);
  });

  it("Member nutzt Agenten und entscheidet Freigaben, konfiguriert aber nicht", () => {
    expect(roleHasPermission("member", "agents", "run")).toBe(true);
    expect(roleHasPermission("member", "approvals", "decide")).toBe(true);
    expect(roleHasPermission("member", "agents", "configure")).toBe(false);
  });

  it("unbekannte Rollen haben keinerlei Rechte", () => {
    expect(roleHasPermission("hacker", "agents", "view")).toBe(false);
  });

  it("alle sechs Rollen sind definiert", () => {
    expect(ALL_ROLES).toEqual([
      "owner",
      "admin",
      "manager",
      "member",
      "viewer",
      "billingAdmin",
    ]);
  });
});
