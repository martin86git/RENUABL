import { describe, expect, it } from "vitest";
import { cleanDesignShade, roofShadeFor, shadeFromReport, shadePercent, shadeWords, type DesignShade } from "./design-shade";
import { buildProposal, viewForChoice } from "./proposal";
import { sampleInputs } from "./proposal-fixture";
import { cleanExtras, withHomeOf } from "./quote";
import { designPanels } from "./roof-design";
import type { ShadeReport } from "./shade";

// 19 Nov 2026, Martin: "how can we incorporate the shade analysis (also into the proposal)".
const months = Array.from({ length: 12 }, (_, m) => (m >= 4 && m <= 6 ? 0.88 : 0.99));

describe("a design's shade, kept and read back", () => {
  const report: ShadeReport = {
    panels: [
      { access: 0.981, byMonth: months },
      { access: 0.86, byMonth: months },
      { access: 0.9999, byMonth: months },
    ],
    access: 0.947,
    byMonth: months,
    worst: 0.86,
    shaded: 1,
  };
  const kept = shadeFromReport(report, ["g:face1:0", "g:face1:1", "l:abc"], "nearmap", "2026-01-27");

  it("keeps each panel by its key, the whole and the months, rounded", () => {
    expect(kept.panels).toEqual({ "g:face1:0": 0.981, "g:face1:1": 0.86, "l:abc": 1 });
    expect(kept.access).toBe(0.947);
    expect(kept.byMonth).toHaveLength(12);
    expect(kept.from).toBe("nearmap");
    expect(kept.captured).toBe("2026-01-27");
  });
  it("cleans what a browser sends: shares only, keys as the designer names panels, twelve months", () => {
    expect(cleanDesignShade(kept)).toEqual(kept);
    expect(cleanDesignShade({ ...kept, access: 2 })).toBeNull();
    expect(cleanDesignShade({ ...kept, byMonth: [1, 1] })).toBeNull();
    const odd = cleanDesignShade({ ...kept, panels: { "g:face1:0": 0.9, "<script>": 0.5, "l:x": 7 } })!;
    expect(Object.keys(odd.panels)).toEqual(["g:face1:0"]);
    expect(cleanDesignShade({ ...kept, panels: {} })).toBeNull();
    expect(cleanDesignShade("nonsense")).toBeNull();
  });
  it("reads back for a proposal's panels only when every one was read, the whole worked again for fewer", () => {
    const all = roofShadeFor(kept, ["g:face1:0", "g:face1:1", "l:abc"])!;
    expect(all.panels).toEqual([0.981, 0.86, 1]);
    expect(all.access).toBe(0.947);
    expect(all.worst).toBe(0.86);
    expect(all.shaded).toBe(1);
    const fewer = roofShadeFor(kept, ["g:face1:0", "l:abc"])!;
    expect(fewer.access).toBe(Math.round(((0.981 + 1) / 2) * 1000) / 1000);
    expect(fewer.shaded).toBe(0);
    expect(roofShadeFor(kept, ["g:face1:0", "g:face1:9"])).toBeNull();
    expect(roofShadeFor(undefined, ["g:face1:0"])).toBeNull();
  });
  it("tells the customer in plain words, never rounding a loss up to 100%, and says it is an estimate", () => {
    expect(shadePercent(0.999)).toBe("99%");
    expect(shadePercent(1)).toBe("100%");
    const words = shadeWords(roofShadeFor(kept, ["g:face1:0", "g:face1:1", "l:abc"])!);
    expect(words.headline).toBe("94% of the year's direct sun reaches your panels");
    expect(words.panels).toMatch(/1 of 3 panels lose more than a tenth/);
    expect(words.note).toMatch(/estimate from Nearmap's height data \(27 Jan 2026\)/);
    expect(words.note).toMatch(/checked on site/);
    expect(words.note).toMatch(/don't take it off/);
  });
  it("is kept with the quote, and a design keeps its own when the home is shared", () => {
    const extras = cleanExtras({ quotes: [{ form: {}, edits: {}, shade: kept }] }, 1, {
      bill: { interval: "quarterly", amount: "", supplyPerDay: "1", rate: "0.3", feedIn: "0.04" },
      postcode: "3150",
    });
    expect(extras.quotes[0].shade).toEqual(kept);
    const other = { form: extras.quotes[0].form, edits: {}, shade: { ...kept, access: 0.5 } as DesignShade };
    expect(withHomeOf(extras.quotes[0], other).shade?.access).toBe(0.5);
  });
});

describe("shade on a published proposal", () => {
  const inputs = sampleInputs({ withBattery: true });
  const design = inputs.project.set.designs[inputs.project.set.primary];
  const keys = designPanels(design).map((p) => p.key);
  const shade: DesignShade = {
    access: 0.93,
    byMonth: months,
    panels: Object.fromEntries(keys.map((k, i) => [k, i % 4 === 0 ? 0.8 : 0.97])),
    from: "google",
  };
  const withShade = {
    ...inputs,
    project: {
      ...inputs.project,
      extras: {
        ...inputs.project.extras,
        quotes: inputs.project.extras.quotes.map((q, i) => (i === inputs.project.set.primary ? { ...q, shade } : q)),
      },
    },
  };

  it("carries the shade on the roof, panel by panel, and on every configurator size worked back from it", () => {
    const built = buildProposal(withShade);
    if (!built.ok) throw new Error(built.problems.join(" "));
    expect(built.view.roof.shade?.panels).toHaveLength(built.view.roof.panels.length);
    expect(built.view.roof.shade?.access).toBe(0.93);
    const cfg = built.view.configurator!;
    for (const size of cfg.sizes) expect(size.roofShade?.panels).toHaveLength(size.panels);
    const smaller = cfg.variants.find((v) => v.size === cfg.sizes[cfg.sizes.length - 1].id)!;
    expect(viewForChoice(built.view, smaller.goal).roof.shade?.panels).toHaveLength(cfg.sizes[cfg.sizes.length - 1].panels);
  });
  it("shows none when the design changed since its reading, or was never read", () => {
    const stale = { ...shade, panels: Object.fromEntries(Object.entries(shade.panels).slice(1)) };
    const changed = {
      ...withShade,
      project: {
        ...withShade.project,
        extras: { ...withShade.project.extras, quotes: withShade.project.extras.quotes.map((q) => ({ ...q, shade: stale })) },
      },
    };
    const built = buildProposal(changed);
    if (!built.ok) throw new Error(built.problems.join(" "));
    expect(built.view.roof.shade).toBeUndefined();
    const plain = buildProposal(inputs);
    if (!plain.ok) throw new Error(plain.problems.join(" "));
    expect(plain.view.roof.shade).toBeUndefined();
  });
});
