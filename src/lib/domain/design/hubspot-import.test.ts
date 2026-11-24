import { describe, expect, it } from "vitest";
import {
  cleanHubSpotKey,
  cleanHubSpotMap,
  dealFromHubSpot,
  engagementLine,
  fieldTargets,
  guessFields,
  guessStage,
  hsDay,
  hubspotProgress,
  nextAfter,
  plainFromHtml,
  readAssociations,
  readPipelines,
  readProperties,
  readRecords,
  valueForField,
  type HsProperty,
} from "./hubspot-import";

const pipelinesRaw = {
  results: [
    {
      id: "default",
      label: "Sales Pipeline",
      displayOrder: 0,
      stages: [
        {
          id: "appointmentscheduled",
          label: "Appointment scheduled",
          displayOrder: 0,
          metadata: { isClosed: "false", probability: "0.2" },
        },
        { id: "123", label: "Quote sent", displayOrder: 1, metadata: { isClosed: "false", probability: "0.6" } },
        { id: "closedwon", label: "Closed won", displayOrder: 2, metadata: { isClosed: "true", probability: "1.0" } },
        { id: "closedlost", label: "Closed lost", displayOrder: 3, metadata: { isClosed: "true", probability: "0.0" } },
      ],
    },
    { id: "999", label: "Old", archived: true, stages: [] },
  ],
};

const propsRaw = {
  results: [
    { name: "dealname", label: "Deal name", type: "string", hubspotDefined: true },
    { name: "description", label: "Deal description", type: "string", hubspotDefined: true },
    { name: "system_size", label: "System Size (kW)", type: "number" },
    { name: "battery_model", label: "Battery model", type: "string" },
    { name: "nmi", label: "NMI", type: "string" },
    {
      name: "roof",
      label: "Roof type",
      type: "enumeration",
      options: [
        { value: "tin", label: "Tin" },
        { value: "tile", label: "Tile" },
      ],
    },
    { name: "export_limited", label: "Export limited", type: "bool" },
    { name: "secret", label: "Hidden", type: "string", hidden: true },
  ],
};

describe("the token", () => {
  it("takes a private app token and forgives paste slips", () => {
    expect(cleanHubSpotKey(" Bearer pat-test-not-a-real-token-for-tests ")).toBe("pat-test-not-a-real-token-for-tests");
    expect(cleanHubSpotKey('"pat-test-another-made-up-one-here"')).toBe("pat-test-another-made-up-one-here");
  });
  it("refuses anything else", () => {
    expect(cleanHubSpotKey("hapikey-123")).toBeNull();
    expect(cleanHubSpotKey("a made up key with spaces in it")).toBeNull();
    expect(cleanHubSpotKey("na1-ab12cd34-5678-90ef-test-service-key")).toBe("na1-ab12cd34-5678-90ef-test-service-key");
    expect(cleanHubSpotKey("pat-ap1-short")).toBeNull();
    expect(cleanHubSpotKey(42)).toBeNull();
  });
});

describe("reading HubSpot", () => {
  it("reads pipelines with their stages, leaving archived ones out", () => {
    const p = readPipelines(pipelinesRaw);
    expect(p).toHaveLength(1);
    expect(p[0].stages.map((s) => s.id)).toEqual(["appointmentscheduled", "123", "closedwon", "closedlost"]);
    expect(p[0].stages[2]).toMatchObject({ closed: true, probability: 1 });
  });
  it("offers the business's own properties first and only a few of HubSpot's", () => {
    const props = readProperties(propsRaw);
    expect(props.map((p) => p.name)).not.toContain("dealname");
    expect(props.map((p) => p.name)).not.toContain("secret");
    expect(props.at(-1)?.name).toBe("description");
    expect(props.find((p) => p.name === "roof")?.options).toHaveLength(2);
  });
  it("reads records, associations and the next page", () => {
    expect(readRecords({ results: [{ id: "5", properties: { a: "x", b: null, c: "" } }, { id: "bad" }] })).toEqual([
      { id: "5", properties: { a: "x" } },
    ]);
    const joined = readAssociations({ results: [{ from: { id: "5" }, to: [{ toObjectId: 7 }, { toObjectId: "8" }] }] });
    expect(joined.get("5")).toEqual(["7", "8"]);
    expect(nextAfter({ paging: { next: { after: "100" } } })).toBe("100");
    expect(nextAfter({ paging: { next: { after: "https://evil" } } })).toBeNull();
  });
});

describe("matching", () => {
  it("guesses each stage from whether it is closed and its name", () => {
    const [p] = readPipelines(pipelinesRaw);
    expect(p.stages.map(guessStage)).toEqual(["lead", "proposal", "won", "lost"]);
    expect(guessStage({ id: "x", label: "Install complete", closed: true, probability: 1 })).toBe("installed");
    expect(guessStage({ id: "x", label: "Installation scheduled", closed: false, probability: 0.9 })).toBe("scheduled");
    expect(guessStage({ id: "x", label: "Grid connection", closed: false, probability: 0.9 })).toBe("grid");
  });
  it("guesses fields by name, each property once", () => {
    const targets = fieldTargets(null);
    const guess = guessFields(targets, readProperties(propsRaw));
    expect(guess.systemSize).toBe("system_size");
    expect(guess.battery).toBe("battery_model");
    expect(guess.nmi).toBe("nmi");
    expect(guess.roofType).toBe("roof");
    expect(new Set(Object.values(guess)).size).toBe(Object.values(guess).length);
  });
  it("keeps only our stages and fields from the browser", () => {
    const targets = fieldTargets(null);
    const map = cleanHubSpotMap(
      {
        stages: { closedwon: "won", "123": "nonsense", "bad id!": "won", closedlost: "skip" },
        fields: { nmi: "nmi", made_up: "x", panel: "BAD-NAME" },
      },
      targets,
    );
    expect(map).toEqual({ stages: { closedwon: "won", closedlost: "skip" }, fields: { nmi: "nmi" } });
  });
  it("keeps a choice only when it is one of ours, and dates as days", () => {
    expect(valueForField({ key: "exportLimiting", label: "", kind: "select", options: ["No", "Yes"] }, "yes")).toBe("Yes");
    expect(valueForField({ key: "exportLimiting", label: "", kind: "select", options: ["No", "Yes"] }, "Maybe")).toBe("");
    expect(valueForField({ key: "solarVicRebate", label: "", kind: "money" }, "$1,400")).toBe("1400");
    expect(hsDay("2026-03-04T14:00:00.000Z")).toBe("2026-03-05");
    expect(hsDay("1772632800000")).toBe("2026-03-05");
  });
});

describe("one deal", () => {
  const props = readProperties(propsRaw);
  const pipelines = readPipelines(pipelinesRaw);
  const targets = fieldTargets(null);
  const map = {
    stages: { closedwon: "won", "123": "proposal", closedlost: "skip" } as const,
    fields: { systemSize: "system_size", roofType: "roof", nmi: "nmi", exportLimiting: "export_limited" },
  };
  const owners = [{ id: "77", email: "sam@sunrise.example", name: "Sam Seller" }];
  const deal = {
    id: "1001",
    properties: {
      dealname: "Jo Citizen - 6.6kW + battery",
      dealstage: "closedwon",
      pipeline: "default",
      amount: "15990.5",
      closedate: "2026-02-10T01:00:00Z",
      createdate: "2026-01-02T01:00:00Z",
      hubspot_owner_id: "77",
      system_size: "6.6",
      roof: "tile",
      nmi: "6305123456",
      export_limited: "true",
      battery_model: "Sigenergy 16",
      description: "<p>Wants it before winter</p>",
    },
  };
  const contact = {
    id: "5",
    properties: {
      firstname: "Jo",
      lastname: "Citizen",
      email: "JO@example.com",
      mobilephone: "0400 000 000",
      address: "1 Sample Street",
      city: "Glen Waverley",
      state: "VIC",
      zip: "3150",
    },
  };

  it("becomes a customer and a deal at the stage matched, with its fields", () => {
    const d = dealFromHubSpot(deal, contact, { map, targets, props, pipelines, owners })!;
    expect(d.customer).toMatchObject({ firstName: "Jo", lastName: "Citizen", email: "jo@example.com", phone: "0400 000 000" });
    expect(d.customer.address).toBe("1 Sample Street, Glen Waverley VIC 3150");
    expect(d.job).toMatchObject({ stage: "won", value: 15990.5, title: "Jo Citizen - 6.6kW + battery" });
    expect(d.job.details).toMatchObject({ systemSize: "6.6", roofType: "Tile", nmi: "6305123456", exportLimiting: "Yes" });
    expect(d.wonOn).toBe("2026-02-10");
    expect(d.owner).toBe("sam@sunrise.example");
    expect(d.note).toContain("Sales Pipeline → Closed won (now Won)");
    // Unmatched properties aren't lost: they are written in the note.
    expect(d.note).toContain("Battery model: Sigenergy 16");
    expect(d.note).toContain("Wants it before winter");
  });
  it("is left out at a stage left in HubSpot", () => {
    expect(
      dealFromHubSpot({ ...deal, properties: { ...deal.properties, dealstage: "closedlost" } }, contact, {
        map,
        targets,
        props,
        pipelines,
        owners,
      }),
    ).toBeNull();
  });
  it("still comes across with no contact, named from the deal", () => {
    const d = dealFromHubSpot({ ...deal, properties: { ...deal.properties, dealstage: "123" } }, null, {
      map,
      targets,
      props,
      pipelines,
      owners,
    })!;
    expect(d.customer.firstName).toBe("Jo Citizen - 6.6kW + battery");
    expect(d.wonOn).toBeNull();
  });
});

describe("engagements", () => {
  const owners = [{ id: "77", email: "sam@sunrise.example", name: "Sam" }];
  it("turns a note's HTML into words, dated and by its owner", () => {
    const line = engagementLine(
      "notes",
      {
        id: "1",
        properties: {
          hs_note_body: "<p>Rang &amp; left a message</p><ul><li>Bill $400</li></ul>",
          hs_timestamp: "2026-01-05T00:00:00Z",
          hubspot_owner_id: "77",
        },
      },
      owners,
    );
    expect(line).toEqual({
      kind: "note",
      text: "Rang & left a message\n• Bill $400",
      at: "2026-01-05T00:00:00.000Z",
      by: "sam@sunrise.example",
    });
  });
  it("writes an email as the deal's email lines read", () => {
    const line = engagementLine(
      "emails",
      {
        id: "2",
        properties: {
          hs_email_subject: "Your quote",
          hs_email_text: "Hi Jo",
          hs_email_direction: "EMAIL",
          hs_email_to_email: "jo@example.com",
          hs_timestamp: "2026-01-06T00:00:00Z",
        },
      },
      owners,
    );
    expect(line?.kind).toBe("email");
    expect(line?.text).toBe("Email to jo@example.com: Your quote\n\nHi Jo");
    expect(line?.by).toBe("hubspot");
  });
  it("gives a call its length and a meeting its title", () => {
    expect(
      engagementLine(
        "calls",
        { id: "3", properties: { hs_call_title: "Follow up", hs_call_duration: "185000", hs_timestamp: "2026-01-07T00:00:00Z" } },
        owners,
      )?.text,
    ).toBe("Follow up · 3 min");
    expect(
      engagementLine(
        "meetings",
        { id: "4", properties: { hs_meeting_title: "Site visit", hs_meeting_start_time: "2026-01-08T00:00:00Z" } },
        owners,
      ),
    ).toMatchObject({ kind: "note", text: "Meeting: Site visit" });
  });
  it("leaves out an empty or undated one", () => {
    expect(
      engagementLine("notes", { id: "1", properties: { hs_note_body: "<p></p>", hs_timestamp: "2026-01-05T00:00:00Z" } }, owners),
    ).toBeNull();
    expect(engagementLine("calls", { id: "1", properties: { hs_call_title: "x" } }, owners)).toBeNull();
  });
  it("reads plain words out of HTML", () => {
    expect(plainFromHtml("<div>a<br>b</div><script>x</script>&#8217;")).toBe("a\nb\n’");
  });
});

it("says how the run is going", () => {
  expect(hubspotProgress({ done: 5, total: 10, already: 1, failed: 1, skipped: 2 })).toBe(
    "5 of 10 deals in · 1 already here · 2 left in HubSpot · 1 couldn't come across",
  );
});

// A property not in the list keeps its raw value in a field.
it("keeps an unknown property's value as it is", () => {
  const unknown: HsProperty | undefined = undefined;
  expect(valueForField({ key: "nmi", label: "NMI", kind: "text" }, unknown ?? "6305")).toBe("6305");
});
