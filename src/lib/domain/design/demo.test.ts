import { describe, expect, it } from "vitest";
import {
  DEMO_DETAILS,
  DEMO_PAGE,
  cleanDemoDetails,
  demoDetailsNote,
  demoEmail,
  demoNeedsDetails,
  demoPageNeedsDetails,
  demoRefuses,
  isDemoEmail,
} from "./demo";
import { mayHaveExamples } from "./example-deals";

describe("the demo's owner email", () => {
  it("is on the reserved demo domain, and only that counts as a demo", () => {
    const email = demoEmail("AB12-cd34");
    expect(email).toBe("demo-ab12cd34@demo.renuabl.example");
    expect(isDemoEmail(email)).toBe(true);
    expect(isDemoEmail(" Demo-x@DEMO.renuabl.example ")).toBe(true);
    expect(isDemoEmail("sam@sunny.com.au")).toBe(false);
    expect(isDemoEmail("sample-retailer@renuabl-staff.example")).toBe(false);
    expect(isDemoEmail("x@notdemo.renuabl.example.com")).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
  });

  it("may be given the example deals", () => {
    expect(mayHaveExamples(demoEmail("abc"))).toBe(true);
  });
});

describe("cleanDemoDetails", () => {
  const good = { name: "  Sam   Lee ", company: " Bright  Wholesale<b> ", email: " Sam@Bright.com.au " };

  it("needs a name, a company and an email", () => {
    expect(cleanDemoDetails({ ...good, name: " " })).toEqual({ ok: false, message: DEMO_DETAILS.missingName });
    expect(cleanDemoDetails({ ...good, company: "" })).toEqual({ ok: false, message: DEMO_DETAILS.missingCompany });
    expect(cleanDemoDetails({ ...good, email: "sam at bright" })).toEqual({ ok: false, message: DEMO_DETAILS.badEmail });
    expect(cleanDemoDetails({ ...good, email: 5 }).ok).toBe(false);
  });

  it("won't take a demo account's own address as the email", () => {
    expect(cleanDemoDetails({ ...good, email: demoEmail("abc") }).ok).toBe(false);
  });

  it("tidies what was typed and splits the name", () => {
    expect(cleanDemoDetails(good)).toEqual({
      ok: true,
      details: { firstName: "Sam", lastName: "Lee", company: "Bright Wholesaleb", email: "sam@bright.com.au" },
    });
    const one = cleanDemoDetails({ ...good, name: "Sam" });
    expect(one.ok && one.details).toMatchObject({ firstName: "Sam", lastName: "" });
    const many = cleanDemoDetails({ ...good, name: "Sam van der Lee" });
    expect(many.ok && many.details.lastName).toBe("van der Lee");
  });

  it("cuts what is too long", () => {
    const r = cleanDemoDetails({ ...good, name: "a".repeat(300), company: "c".repeat(500) });
    expect(r.ok && r.details.firstName.length).toBe(40);
    expect(r.ok && r.details.company.length).toBe(80);
  });
});

describe("the staff note", () => {
  it("says who, where from, and that the email isn't verified", () => {
    const note = demoDetailsNote({ firstName: "Sam", lastName: "Lee", company: "Bright Wholesale", email: "sam@bright.com.au" });
    expect(note.subject).toBe("RENUABL Business demo: Sam Lee, Bright Wholesale");
    expect(note.text).toContain("sam@bright.com.au");
    expect(note.text).toContain("not verified");
  });
});

describe("demoRefuses", () => {
  it("never refuses reading", () => {
    expect(demoRefuses("GET", "/api/design/jobs/job_1/email")).toBe(false);
    expect(demoRefuses("GET", "/api/design/posts")).toBe(false);
    expect(demoRefuses(null, "/api/design/members")).toBe(false);
  });

  it("refuses what reaches a real person, another business or money", () => {
    for (const path of [
      "/api/design/jobs/job_1/email",
      "/api/design/jobs/job_1/call",
      "/api/design/jobs/job_1/share",
      "/api/design/customers/group-email",
      "/api/design/orders/job_1/email",
      "/api/design/sol-agents",
      "/api/design/inbox",
      "/api/design/posts",
      "/api/design/posts/p1",
      "/api/design/connections",
      "/api/design/marketplace/l1",
      "/api/design/trade/t1/photos",
      "/api/design/members",
      "/api/design/billing",
      "/api/design/connect/",
      "/api/design/subscribe",
    ])
      expect(demoRefuses("POST", path), path).toBe(true);
    expect(demoRefuses("DELETE", "/api/design/members")).toBe(true);
  });

  it("leaves the demo's own work alone", () => {
    for (const path of [
      "/api/design/jobs",
      "/api/design/jobs/job_1",
      "/api/design/jobs/job_1/proposal",
      "/api/design/jobs/job_1/chat",
      "/api/design/jobs/job_1/team",
      "/api/design/projects",
      "/api/design/sol",
      "/api/design/brand",
      "/api/design/feed",
      "/api/design/connectors",
      "/api/design/postscript",
    ])
      expect(demoRefuses("POST", path), path).toBe(false);
  });

  it("stops the job card being emailed but lets a note be added", () => {
    expect(demoRefuses("PUT", "/api/design/jobs/job_1/card")).toBe(true);
    expect(demoRefuses("POST", "/api/design/jobs/job_1/card")).toBe(false);
  });
});

describe("demoNeedsDetails", () => {
  it("asks before a roof is fetched, however it is asked for", () => {
    expect(demoNeedsDetails("GET", "/api/design/roof")).toBe(true);
    expect(demoNeedsDetails("GET", "/api/design/roof/nearmap/heights")).toBe(true);
    expect(demoNeedsDetails("POST", "/api/design/roof/check")).toBe(true);
  });

  it("asks before Sol is asked, a roof is kept or a proposal published", () => {
    for (const path of [
      "/api/design/sol",
      "/api/design/command",
      "/api/design/bill",
      "/api/design/projects",
      "/api/design/projects/p1",
      "/api/design/jobs/job_1/proposal",
      "/api/design/jobs/job_1/write",
      "/api/design/jobs/job_1/call-notes/points",
      "/api/design/jobs/job_1/chat/draft",
      "/api/design/invoices/read",
    ])
      expect(demoNeedsDetails("POST", path), path).toBe(true);
    expect(demoNeedsDetails("PUT", "/api/design/projects/p1")).toBe(true);
  });

  it("lets them look around and work the deals without asking", () => {
    for (const path of ["/api/design/sol", "/api/design/projects", "/api/design/jobs/job_1/proposal", "/api/design/feed", "/api/design/me"])
      expect(demoNeedsDetails("GET", path), path).toBe(false);
    for (const path of [
      "/api/design/jobs",
      "/api/design/jobs/job_1",
      "/api/design/jobs/job_1/chat",
      "/api/design/feed",
      "/api/design/solar",
      "/api/design/roofing",
    ])
      expect(demoNeedsDetails("POST", path), path).toBe(false);
  });
});

describe("demoPageNeedsDetails", () => {
  it("is the designer opened on a roof, not its home", () => {
    expect(demoPageNeedsDetails("/design/roof", "?job=job_1&embed=1")).toBe(true);
    expect(demoPageNeedsDetails("/design/roof", "?at=-37.8,145.1&address=x")).toBe(true);
    expect(demoPageNeedsDetails("/design/roof", "")).toBe(false);
    expect(demoPageNeedsDetails("/design", "?job=1")).toBe(false);
    expect(demoPageNeedsDetails("/design/deals/job_1", "")).toBe(false);
  });
});

describe("the demo's words", () => {
  const words = [
    DEMO_PAGE.headline,
    DEMO_PAGE.what,
    DEMO_PAGE.note,
    DEMO_PAGE.bar,
    DEMO_DETAILS.title,
    DEMO_DETAILS.intro,
    DEMO_DETAILS.consent,
    ...DEMO_PAGE.does.flatMap((d) => [d.title, d.body]),
  ].join(" ");

  it("says what RENUABL is and what it does", () => {
    expect(DEMO_PAGE.what).toMatch(/solar retailers and installers/);
    expect(DEMO_PAGE.does.length).toBeGreaterThanOrEqual(3);
  });

  it("makes no claim it can't prove, and quotes no price", () => {
    expect(words).not.toMatch(/\b(best|leading|first|fastest|guarantee\w*|exact|precise|#1|number one)\b/i);
    expect(words).not.toMatch(/\$\d/);
  });
});
