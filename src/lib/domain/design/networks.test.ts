import { describe, expect, it } from "vitest";
import { SOL_NETWORKS, VIC_DISTRIBUTORS, distributorFor, distributorForNmi, distributorNamed } from "./networks";
import { TEAM_CHANNELS, isChannel, roomLabel } from "./team-chat";
import { solSystem } from "./sol";

describe("the Grid connections channel", () => {
  it("is one of the channels the whole business shares", () => {
    expect(TEAM_CHANNELS.map((c) => c.id)).toContain("grid");
    expect(isChannel("grid")).toBe(true);
    expect(roomLabel("grid", "sam@example.com")).toBe("Grid connections");
  });
});

describe("Victoria's distributors", () => {
  it("are all five, each with its own NMI start and an https site", () => {
    expect(VIC_DISTRIBUTORS.map((d) => d.name)).toEqual(["CitiPower", "Powercor", "Jemena", "United Energy", "AusNet Services"]);
    expect(new Set(VIC_DISTRIBUTORS.map((d) => d.nmiStarts)).size).toBe(5);
    for (const d of VIC_DISTRIBUTORS) expect(d.url).toMatch(/^https:\/\//);
  });
  it("are found from a deal's Distributor detail however it is written", () => {
    expect(distributorNamed("United Energy")?.id).toBe("united-energy");
    expect(distributorNamed("UE")?.id).toBe("united-energy");
    expect(distributorNamed("AusNet")?.id).toBe("ausnet");
    expect(distributorNamed("citi power")?.id).toBe("citipower");
    expect(distributorNamed("Ergon")).toBeNull();
    expect(distributorNamed("")).toBeNull();
  });
  it("are found from a meter's NMI", () => {
    expect(distributorForNmi("6407 123 456")?.name).toBe("United Energy");
    expect(distributorForNmi("4102000000")).toBeNull();
  });
});

describe("what Sol knows of the networks", () => {
  it("names every network and always sends them to its current guide", () => {
    for (const d of VIC_DISTRIBUTORS) expect(SOL_NETWORKS).toContain(d.name);
    expect(SOL_NETWORKS).toMatch(/check the distributor's current connection guide/);
    expect(SOL_NETWORKS).toMatch(/Never say a site will be approved/);
    expect(SOL_NETWORKS).toMatch(/CSIP-AUS/);
  });
  it("is in his instructions", () => {
    const prompt = solSystem({
      business: "Sunrise Solar",
      member: "Sam",
      costs: true,
      facts: "",
      prefs: [],
      now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(prompt).toContain("Grid connections:");
  });
});

describe("a deal's distributor from its address", () => {
  it("is the NMI's when the deal has one, whatever the postcode says", () => {
    expect(distributorFor({ address: "8 Example Court, Glen Waverley VIC 3150", nmi: "6305 1234 567" })).toEqual({
      name: "AusNet Services",
      how: "nmi",
    });
  });
  it("is guessed from a Victorian postcode", () => {
    expect(distributorFor({ address: "8 Example Court, Glen Waverley VIC 3150" })).toEqual({ name: "United Energy", how: "postcode" });
    expect(distributorFor({ address: "1 Sample St, Melbourne VIC 3000" })?.name).toBe("CitiPower");
    expect(distributorFor({ address: "1 Sample St, Coburg VIC 3058" })?.name).toBe("Jemena");
    expect(distributorFor({ address: "1 Sample St, Werribee VIC 3030" })?.name).toBe("Powercor");
    expect(distributorFor({ address: "1 Sample St, Geelong VIC 3220" })?.name).toBe("Powercor");
    expect(distributorFor({ address: "1 Sample St, Traralgon VIC 3844" })?.name).toBe("AusNet Services");
    expect(distributorFor({ address: "1 Sample St, Frankston VIC 3199" })?.name).toBe("United Energy");
  });
  it("is the state's one network where there is only one", () => {
    expect(distributorFor({ address: "1 Sample St, Adelaide SA 5000" })).toEqual({ name: "SA Power Networks", how: "state" });
  });
  it("is unknown elsewhere, and with no address", () => {
    expect(distributorFor({ address: "1 Sample St, Sydney NSW 2000" })).toBeNull();
    expect(distributorFor({ address: "" })).toBeNull();
    expect(distributorFor({})).toBeNull();
  });
  it("covers every Victorian postcode a home has", () => {
    for (let p = 3000; p <= 3999; p++) {
      // Numbers no Victorian locality uses.
      if ([3009, 3069, 3100, 3117, 3118, 3119, 3120].includes(p)) continue;
      expect(distributorFor({ address: `x VIC ${p}` }), String(p)).not.toBeNull();
    }
  });
});
