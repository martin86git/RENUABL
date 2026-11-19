import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_MAX, announcementShows, defaultBrand, cleanAnnouncement, cleanBrandKit } from "./brand";
import { buildProposal } from "./proposal";
import { sampleBrand, sampleInputs } from "./proposal-fixture";

describe("the configurator's announcement for a special", () => {
  it("keeps one plain line and a real date, or nothing", () => {
    expect(cleanAnnouncement({ text: "  Free EV charger\nwith every battery  ", until: "2026-11-30" })).toEqual({
      text: "Free EV charger with every battery",
      until: "2026-11-30",
    });
    expect(cleanAnnouncement({ text: "x".repeat(400), until: "30/11/2026" })).toEqual({ text: "x".repeat(ANNOUNCEMENT_MAX), until: null });
    expect(cleanAnnouncement("nonsense")).toEqual({ text: "", until: null });
  });

  it("shows while it has words and its day hasn't passed", () => {
    expect(announcementShows({ text: "Special", until: null }, "2026-11-19")).toBe(true);
    expect(announcementShows({ text: "Special", until: "2026-11-19" }, "2026-11-19")).toBe(true);
    expect(announcementShows({ text: "Special", until: "2026-11-18" }, "2026-11-19")).toBe(false);
    expect(announcementShows({ text: "", until: null }, "2026-11-19")).toBe(false);
    expect(announcementShows(undefined, "2026-11-19")).toBe(false);
  });

  it("is kept on the brand kit only when sent", () => {
    const first = cleanBrandKit({ announcement: { text: "Winter special", until: null } }, defaultBrand("Sunrise Solar"));
    if (!first.ok) throw new Error(first.message);
    expect(first.value.announcement.text).toBe("Winter special");
    const again = cleanBrandKit({ name: "Other" }, first.value);
    expect(again.ok && again.value.announcement.text).toBe("Winter special");
  });

  it("goes out with a proposal published while it shows, and never after its day", () => {
    const inputs = sampleInputs();
    const on = buildProposal({ ...inputs, brand: { ...sampleBrand(), announcement: { text: "Free EV charger", until: null } } });
    if (!on.ok) throw new Error(on.problems.join("; "));
    expect(on.view.announcement?.text).toBe("Free EV charger");
    const past = buildProposal({ ...inputs, brand: { ...sampleBrand(), announcement: { text: "Gone", until: "2000-01-01" } } });
    if (!past.ok) throw new Error(past.problems.join("; "));
    expect(past.view.announcement).toBeUndefined();
  });
});
