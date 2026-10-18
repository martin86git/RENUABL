import { describe, expect, it } from "vitest";
import { installPhase } from "./deal";

const today = "2026-10-18";
const done = { customerInvoice: "paid", stcClaim: "claimed", gridConnection: "completed" };

describe("where an installation is", () => {
  it("is upcoming while sold and its day hasn't come, or there's no day yet", () => {
    expect(installPhase({ stage: "won", installDate: null, details: {} }, today)).toBe("upcoming");
    expect(installPhase({ stage: "scheduled", installDate: "2026-10-19", details: {} }, today)).toBe("upcoming");
  });

  it("is in the works once its day has come, or it's installed with paperwork open", () => {
    expect(installPhase({ stage: "scheduled", installDate: "2026-10-18", details: {} }, today)).toBe("in-works");
    expect(installPhase({ stage: "installed", installDate: "2026-10-01", details: { customerInvoice: "paid" } }, today)).toBe("in-works");
  });

  it("is completed when installed with the invoice paid, the STCs claimed and the grid connected", () => {
    expect(installPhase({ stage: "grid", installDate: "2026-10-01", details: done }, today)).toBe("completed");
  });

  it("is nothing for a deal not sold, or lost", () => {
    expect(installPhase({ stage: "proposal", installDate: null, details: {} }, today)).toBeNull();
    expect(installPhase({ stage: "lost", installDate: "2026-10-01", details: done }, today)).toBeNull();
  });
});
