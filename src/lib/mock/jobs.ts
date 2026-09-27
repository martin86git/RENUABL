import { marketDateTime, todayInMarket } from "@/lib/domain/market";
import { addDays, fromISODate, toISODate } from "@/lib/domain/scheduling";
import type { Job, JobDocument, ChecklistItem } from "@/lib/domain/types";

// Fictional Victorian jobs for the installer portal. Replace with the jobs API.

// Dates are relative to "today" in the launch market so the mock portal always has a live-looking day.
function relative(now: Date) {
  const today = fromISODate(todayInMarket(now));
  const d = (offset: number) => toISODate(addDays(today, offset));
  // Wall-clock times in Melbourne, so they read correctly on any server or browser.
  const at = (offset: number, hour: number, minute = 0) => marketDateTime(d(offset), hour, minute);
  return { d, at };
}

const checklist = (doneCount: number): ChecklistItem[] =>
  [
    "Site safety assessment",
    "Roof condition photographed",
    "Switchboard inspected",
    "Array mounted and earthed",
    "Inverter commissioned",
    "Battery commissioned",
    "Customer walkthrough",
    "Compliance certificate lodged",
  ].map((label, i) => ({ id: `c${i}`, label, done: i < doneCount }));

const docs = (overrides: Partial<Record<string, JobDocument["status"]>> = {}): JobDocument[] => [
  { id: "d1", name: "Network pre-approval", kind: "approval", status: overrides.d1 ?? "ready" },
  { id: "d2", name: "System design & panel layout", kind: "design", status: overrides.d2 ?? "ready" },
  { id: "d3", name: "Customer agreement", kind: "contract", status: overrides.d3 ?? "ready" },
  { id: "d4", name: "Certificate of compliance", kind: "compliance", status: overrides.d4 ?? "required" },
  { id: "d5", name: "Installation photos", kind: "photo", status: overrides.d5 ?? "required" },
];

const imagery = [
  { id: "img1", label: "Aerial · north roof" },
  { id: "img2", label: "Street view" },
  { id: "img3", label: "Switchboard" },
];

/** Demo only: a stable record key per sample job. Real jobs get a random key when they're created. */
export function demoRecordKey(jobId: string) {
  let h = 2166136261;
  for (const c of `renuabl-demo-${jobId}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  let out = "";
  for (let i = 0; i < 24; i++) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
    out += (h % 36).toString(36);
  }
  return out;
}

export function buildJobs(now = new Date()): Job[] {
  const { d, at } = relative(now);
  const jobs: Omit<Job, "recordKey">[] = [
    {
      id: "job_1042",
      reference: "RN-1042",
      customer: { name: "Sarah Chen", phone: "0401 555 567", email: "sarah.chen@example.com" },
      address: { line: "2 Hanwell Court", suburb: "Glen Waverley", state: "VIC", postcode: "3150" },
      packageName: "Whole Home · 13.2 kW + 13.5 kWh",
      system: { panelCount: 30, batteryKwh: 13.5, evCharger: false },
      stage: "scheduled",
      preferredDate: d(0),
      windowId: "0700",
      crewId: "crew_a",
      value: 17_840,
      site: {
        storeys: "single",
        roof: "Colorbond, 22° pitch",
        orientation: "North / west split",
        accessNotes: "Side gate, easy access. Customer home during install.",
        switchboardNotes: "Main switchboard in garage. Ceramic fuses — upgrade to RCBOs quoted and approved.",
        imagery,
      },
      checklist: checklist(0),
      documents: docs(),
      messages: [
        { id: "m1", from: "customer", author: "Sarah Chen", body: "Is there anything I need to do before Thursday?", at: at(-2, 18, 12) },
        {
          id: "m2",
          from: "installer",
          author: "Michael Tran",
          body: "Just make sure the garage is accessible. We'll take care of the rest!",
          at: at(-2, 19, 3),
        },
      ],
      activity: [
        { id: "a1", label: "Deposit paid", at: at(-14, 10, 22) },
        { id: "a2", label: "Confirmation call completed", at: at(-12, 14, 0) },
        { id: "a3", label: "Job accepted by Primero Electric & Solar", at: at(-12, 16, 40) },
        { id: "a4", label: "Network pre-approval granted", at: at(-6, 9, 5) },
      ],
      statusHistory: [],
    },
    {
      id: "job_1043",
      reference: "RN-1043",
      customer: { name: "Michael Torres", phone: "0421 555 330", email: "michael.torres@example.com" },
      address: { line: "8 Park Road", suburb: "Brighton", state: "VIC", postcode: "3186" },
      packageName: "Solar Essentials · 6.6 kW",
      system: { panelCount: 15, batteryKwh: 0, evCharger: false },
      stage: "scheduled",
      preferredDate: d(0),
      windowId: "0700",
      crewId: "crew_b",
      value: 5_560,
      site: {
        storeys: "double",
        roof: "Terracotta tile, 25° pitch",
        orientation: "North",
        accessNotes: "Rear lane access only. Park in lane, not on street (clearway).",
        switchboardNotes: "Switchboard on front verandah, recently upgraded.",
        imagery,
      },
      checklist: checklist(0),
      documents: docs(),
      messages: [],
      activity: [
        { id: "a1", label: "Deposit paid", at: at(-20, 11, 0) },
        { id: "a2", label: "Job accepted by Primero Electric & Solar", at: at(-18, 9, 30) },
      ],
      statusHistory: [],
    },
    {
      id: "job_1038",
      reference: "RN-1038",
      customer: { name: "Priya Nair", phone: "0433 555 912", email: "priya.nair@example.com" },
      address: { line: "4 Linden Way", suburb: "Doncaster", state: "VIC", postcode: "3108" },
      packageName: "Whole Home + EV · 11 kW + 13.5 kWh",
      system: { panelCount: 25, batteryKwh: 13.5, evCharger: true },
      stage: "in-progress",
      preferredDate: d(0),
      windowId: "0700",
      crewId: "crew_c",
      value: 22_410,
      site: {
        storeys: "single",
        roof: "Colorbond, 15° pitch",
        orientation: "North-east",
        accessNotes: "Wide driveway. Customer works from home.",
        switchboardNotes: "Sub-board in garage for EV charger circuit.",
        imagery,
      },
      checklist: checklist(5),
      documents: docs({ d5: "submitted" }),
      messages: [],
      activity: [{ id: "a1", label: "Installation started", at: at(0, 13, 5) }],
      statusHistory: [
        { status: "en-route", at: at(0, 12, 25) },
        { status: "on-site", at: at(0, 12, 58) },
        { status: "installing", at: at(0, 13, 5) },
      ],
    },
    {
      id: "job_1051",
      reference: "RN-1051",
      customer: { name: "Anika Shah", phone: "0400 555 761", email: "anika.shah@example.com" },
      address: { line: "41 Grevillea Crescent", suburb: "Coburg", state: "VIC", postcode: "3058" },
      packageName: "Whole Home · 7.9 kW + 10 kWh",
      system: { panelCount: 18, batteryKwh: 10, evCharger: false },
      stage: "new",
      preferredDate: d(12),
      windowId: "0700",
      crewId: null,
      value: 14_920,
      site: {
        storeys: "double",
        roof: "Concrete tile, 20° pitch",
        orientation: "North / east split",
        accessNotes: "Apartment-style driveway, shared with neighbour.",
        switchboardNotes: "Photos provided by customer — looks recent.",
        imagery,
      },
      checklist: checklist(0),
      documents: docs({ d1: "required", d3: "submitted" }),
      messages: [],
      activity: [{ id: "a1", label: "Deposit paid", at: at(-1, 20, 14) }],
      statusHistory: [],
    },
    {
      id: "job_1052",
      reference: "RN-1052",
      customer: { name: "Jordan Lee", phone: "0455 555 204", email: "jordan.lee@example.com" },
      address: { line: "118 Station Street", suburb: "Box Hill", state: "VIC", postcode: "3128" },
      packageName: "Solar Essentials · 7.0 kW",
      system: { panelCount: 16, batteryKwh: 0, evCharger: false },
      stage: "new",
      preferredDate: d(15),
      windowId: "0700",
      crewId: null,
      value: 5_870,
      site: {
        storeys: "single",
        roof: "Colorbond, 10° pitch",
        orientation: "North-west",
        accessNotes: "Street parking only.",
        switchboardNotes: "Unknown — request photo.",
        imagery,
      },
      checklist: checklist(0),
      documents: docs({ d1: "required" }),
      messages: [],
      activity: [{ id: "a1", label: "Deposit paid", at: at(0, 8, 2) }],
      statusHistory: [],
    },
    {
      id: "job_1047",
      reference: "RN-1047",
      customer: { name: "Grace O'Neill", phone: "0466 555 118", email: "grace.oneill@example.com" },
      address: { line: "7 Bay View Road", suburb: "Brighton", state: "VIC", postcode: "3186" },
      packageName: "Whole Home · 10.1 kW + 13.5 kWh",
      system: { panelCount: 23, batteryKwh: 13.5, evCharger: false },
      stage: "accepted",
      preferredDate: d(6),
      windowId: "0700",
      crewId: null,
      value: 19_300,
      site: {
        storeys: "double",
        roof: "Slate, 30° pitch",
        orientation: "North",
        accessNotes: "Steep driveway. Scaffold required on south side.",
        switchboardNotes: "Switchboard in laundry.",
        imagery,
      },
      checklist: checklist(0),
      documents: docs({ d1: "submitted" }),
      messages: [],
      activity: [{ id: "a1", label: "Job accepted by Primero Electric & Solar", at: at(-3, 10, 0) }],
      statusHistory: [],
    },
    {
      id: "job_1045",
      reference: "RN-1045",
      customer: { name: "James Wilson", phone: "0477 555 640", email: "james.wilson@example.com" },
      address: { line: "16 Cypress Avenue", suburb: "Camberwell", state: "VIC", postcode: "3124" },
      packageName: "Solar Essentials · 6.6 kW",
      system: { panelCount: 15, batteryKwh: 0, evCharger: false },
      stage: "scheduled",
      preferredDate: d(2),
      windowId: "0700",
      crewId: "crew_a",
      value: 5_560,
      site: {
        storeys: "single",
        roof: "Colorbond, 18° pitch",
        orientation: "North",
        accessNotes: "Front access, no restrictions.",
        switchboardNotes: "Modern board with RCDs.",
        imagery,
      },
      checklist: checklist(0),
      documents: docs(),
      messages: [],
      activity: [],
      statusHistory: [],
    },
    {
      id: "job_1046",
      reference: "RN-1046",
      customer: { name: "Nadia Ibrahim", phone: "0488 555 427", email: "nadia.i@example.com" },
      address: { line: "12 Beach Street", suburb: "Elwood", state: "VIC", postcode: "3184" },
      packageName: "Whole Home · 8.4 kW + 10 kWh",
      system: { panelCount: 19, batteryKwh: 10, evCharger: false },
      stage: "scheduled",
      preferredDate: d(3),
      windowId: "0700",
      crewId: "crew_b",
      value: 15_380,
      site: {
        storeys: "double",
        roof: "Terracotta tile, 22° pitch",
        orientation: "North-east",
        accessNotes: "Loading zone out front 7–10am.",
        switchboardNotes: "Switchboard in hallway cupboard.",
        imagery,
      },
      checklist: checklist(0),
      documents: docs(),
      messages: [],
      activity: [],
      statusHistory: [],
    },
    {
      id: "job_1031",
      reference: "RN-1031",
      customer: { name: "Chris Nguyen", phone: "0499 555 305", email: "chris.n@example.com" },
      address: { line: "8 Myrtle Lane", suburb: "Preston", state: "VIC", postcode: "3072" },
      packageName: "Whole Home · 8.8 kW + 13.5 kWh",
      system: { panelCount: 20, batteryKwh: 13.5, evCharger: false },
      stage: "completed",
      preferredDate: d(-5),
      windowId: "0700",
      crewId: "crew_a",
      value: 17_840,
      site: {
        storeys: "single",
        roof: "Colorbond, 20° pitch",
        orientation: "North",
        accessNotes: "—",
        switchboardNotes: "Upgraded during install.",
        imagery,
      },
      checklist: checklist(8),
      documents: docs({ d4: "submitted", d5: "submitted" }),
      messages: [],
      activity: [{ id: "a1", label: "Installation completed", at: at(-5, 15, 20) }],
      statusHistory: [
        { status: "en-route", at: at(-5, 6, 50) },
        { status: "on-site", at: at(-5, 7, 25) },
        { status: "installing", at: at(-5, 7, 35) },
        { status: "final-checks", at: at(-5, 14, 10) },
        { status: "complete", at: at(-5, 15, 20) },
      ],
    },
    {
      id: "job_1029",
      reference: "RN-1029",
      customer: { name: "Emma Davies", phone: "0411 555 873", email: "emma.d@example.com" },
      address: { line: "30 Kent Street", suburb: "Footscray", state: "VIC", postcode: "3011" },
      packageName: "Solar Essentials · 6.6 kW",
      system: { panelCount: 15, batteryKwh: 0, evCharger: false },
      stage: "completed",
      preferredDate: d(-9),
      windowId: "0700",
      crewId: "crew_c",
      value: 5_560,
      site: {
        storeys: "single",
        roof: "Tile, 22° pitch",
        orientation: "North-west",
        accessNotes: "—",
        switchboardNotes: "—",
        imagery,
      },
      checklist: checklist(8),
      documents: docs({ d4: "submitted", d5: "submitted" }),
      messages: [],
      activity: [{ id: "a1", label: "Installation completed", at: at(-9, 13, 45) }],
      statusHistory: [
        { status: "en-route", at: at(-9, 8, 20) },
        { status: "on-site", at: at(-9, 8, 55) },
        { status: "installing", at: at(-9, 9, 5) },
        { status: "final-checks", at: at(-9, 12, 50) },
        { status: "complete", at: at(-9, 13, 45) },
      ],
    },
  ];
  return jobs.map((j) => ({ ...j, recordKey: demoRecordKey(j.id) }));
}

export const INSTALLER_PERFORMANCE = {
  jobsCompletedThisMonth: 38,
  jobsCompletedLastMonth: 34,
  onTimeRate: 0.97,
  firstTimePassRate: 0.98,
  defectRate: 0.02,
  customerRating: 4.7, // Primero's public Google rating
  medianResponseHours: 1.6,
  payoutsThisMonth: 186_420,
  pendingPayouts: 42_380,
  trend: [
    { label: "Apr", jobs: 29 },
    { label: "May", jobs: 31 },
    { label: "Jun", jobs: 33 },
    { label: "Jul", jobs: 30 },
    { label: "Aug", jobs: 34 },
    { label: "Sep", jobs: 38 },
  ],
};

export function buildPayouts(now = new Date()) {
  const { d } = relative(now);
  return [
    { id: "p1", reference: "RN-1031", amount: 16_950, status: "paid" as const, date: d(-2) },
    { id: "p2", reference: "RN-1029", amount: 5_280, status: "paid" as const, date: d(-6) },
    { id: "p3", reference: "RN-1038", amount: 21_290, status: "pending" as const, date: d(3) },
    { id: "p4", reference: "RN-1027", amount: 14_610, status: "paid" as const, date: d(-11) },
  ];
}

export const RESOURCES = [
  { id: "r1", title: "RENUABL install standard", body: "Workmanship expectations, photo requirements and handover script." },
  { id: "r2", title: "Commissioning checklist", body: "Step-by-step commissioning for supported inverters and batteries." },
  { id: "r3", title: "Customer handover guide", body: "How to walk a customer through the My RENUABL app." },
  { id: "r4", title: "Safety & SWMS templates", body: "Current safe work method statements for roof work." },
];
