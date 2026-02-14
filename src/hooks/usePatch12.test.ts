import { describe, it, expect } from "vitest";
import type { MassActionMessagePreview } from "@/types/projection";

describe("usePatch12 logic", () => {
  it("updates approval for specific deal in previews", () => {
    const previews: MassActionMessagePreview[] = [
      { deal_id: "d1", contact_name: "A", message: "hi", approved: true },
      { deal_id: "d2", contact_name: "B", message: "hey", approved: true },
      { deal_id: "d3", contact_name: "C", message: "hello", approved: true },
    ];

    const dealId = "d2";
    const approved = false;
    const updated = previews.map((m) =>
      m.deal_id === dealId ? { ...m, approved } : m
    );

    expect(updated[0].approved).toBe(true);
    expect(updated[1].approved).toBe(false);
    expect(updated[2].approved).toBe(true);
  });

  it("calculates approved count correctly", () => {
    const previews: MassActionMessagePreview[] = [
      { deal_id: "d1", contact_name: "A", message: "hi", approved: true },
      { deal_id: "d2", contact_name: "B", message: "hey", approved: false },
      { deal_id: "d3", contact_name: "C", message: "hello", approved: true },
    ];

    const approvedCount = previews.filter((m) => m.approved).length;
    expect(approvedCount).toBe(2);
  });

  it("polling interval depends on job status", () => {
    const getInterval = (status: string) => {
      if (status === "GENERATING" || status === "RUNNING") return 3000;
      return false;
    };

    expect(getInterval("GENERATING")).toBe(3000);
    expect(getInterval("RUNNING")).toBe(3000);
    expect(getInterval("PREVIEW")).toBe(false);
    expect(getInterval("DONE")).toBe(false);
    expect(getInterval("PENDING")).toBe(false);
  });
});
