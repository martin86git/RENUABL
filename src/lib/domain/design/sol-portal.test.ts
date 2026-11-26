import { describe, expect, it } from "vitest";
import { VIC_DISTRIBUTORS } from "./networks";
import { cleanPortal, networkNamed, portalFacts, portalNote, portalOf, portalWindow } from "./sol-portal";
import { cleanTurns } from "./sol";

describe("a network's portal", () => {
  it("is found by id or any usual spelling", () => {
    expect(networkNamed("ausnet")?.id).toBe("ausnet");
    expect(networkNamed("AusNet Services")?.id).toBe("ausnet");
    expect(networkNamed("United Energy")?.id).toBe("united-energy");
    expect(networkNamed("https://evil.example")).toBeNull();
    expect(networkNamed("")).toBeNull();
  });

  it("opens only our own addresses, all https", () => {
    for (const d of VIC_DISTRIBUTORS) {
      const o = portalOf(d.id)!;
      expect(o.url.startsWith("https://")).toBe(true);
      expect(o.known).toBe(Boolean(d.portal));
    }
    expect(portalOf("ausnet")).toMatchObject({ name: "EnergyConnect", url: "https://portal.ausnetservices.com.au/" });
    // No portal on file: the network's own site, said as such.
    expect(portalOf("united-energy")).toMatchObject({ known: false, url: "https://www.unitedenergy.com.au" });
    expect(portalOf("nowhere")).toBeNull();
  });
});

describe("the deal's details to copy across", () => {
  it("lists only what the deal knows, the NMI first", () => {
    const facts = portalFacts({
      customer: "Sam Sample",
      address: "8 Example Court, Glen Waverley VIC 3150",
      phone: "",
      email: null,
      kw: 6.65,
      details: { nmi: "6305 123 456", inverter: "Sungrow SG5.0RS", inverterQty: "2", panel: "Jinko 475", panelQty: "14", battery: "" },
    });
    expect(facts[0]).toEqual({ label: "NMI", value: "6305 123 456" });
    expect(facts.map((f) => f.label)).toEqual(["NMI", "Customer", "Site address", "Solar size", "Panels", "Inverter"]);
    expect(facts.find((f) => f.label === "Inverter")?.value).toBe("2 × Sungrow SG5.0RS");
    expect(facts.find((f) => f.label === "Solar size")?.value).toBe("6.65 kW");
  });
});

describe("a portal kept on Sol's turn", () => {
  it("keeps a network of ours and tidy lines, and never an address", () => {
    const kept = cleanPortal({
      network: "ausnet",
      jobId: "job_1",
      customer: "Sam Sample",
      url: "https://evil.example",
      facts: [{ label: "NMI", value: " 6305\n1 " }, { label: "", value: "x" }, "nope"],
    });
    expect(kept).toEqual({ network: "ausnet", jobId: "job_1", customer: "Sam Sample", facts: [{ label: "NMI", value: "6305 1" }] });
    expect(cleanPortal({ network: "evil", facts: [] })).toBeNull();
    expect(cleanPortal({ network: "ausnet", jobId: "../x", facts: [] })).toEqual({ network: "ausnet", facts: [] });
  });

  it("survives the conversation's own cleaning, on Sol's turns only", () => {
    const at = new Date().toISOString();
    const portal = { network: "powercor", facts: [] };
    const turns = cleanTurns([
      { role: "you", text: "open the portal", at, portal },
      { role: "sol", text: "Here it is.", at, portal },
    ]);
    expect(turns[0].portal).toBeUndefined();
    expect(turns[1].portal).toEqual(portal);
  });

  it("tells Sol what is under his answer", () => {
    expect(portalNote({ network: "ausnet", jobId: "j", facts: [{ label: "Customer", value: "Sam" }] })).toContain("no NMI yet");
    expect(portalNote({ network: "ausnet", guessed: true, facts: [] })).toContain("postcode");
    expect(portalNote({ network: "united-energy", facts: [] })).toContain("website");
  });
});

describe("the portal's window", () => {
  it("sits down the right of the screen and hands the portal nothing of RENUABL", () => {
    const f = portalWindow({ width: 1920, height: 1040, left: 0, top: 0 });
    expect(f).toContain("popup=yes");
    expect(f).toContain("noopener");
    expect(f).toContain("width=883");
    expect(f).toContain("left=1037");
    // A small screen still gets a usable window.
    expect(portalWindow({ width: 800, height: 600 })).toContain("width=480");
  });
});
