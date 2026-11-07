import type { JobStage } from "./crm";

/**
 * Example deals for trying the deal feed (deal-feed.ts; 6 Nov 2026, Martin), added only to a made-up business (one
 * whose owner's email ends ".example": the staff sample retailer and the local demo business), never a real one.
 * Plainly fictional: names made up, "Sample Street" addresses with no place on the map (so their roofs are drawn, never
 * a real home), example.com emails, mobiles from the range set aside for fiction. All kept as `EXAMPLE_SOURCE`, so
 * they are cleared in one go.
 */
export const EXAMPLE_SOURCE = "Example deal";

/** Only a made-up business gets example deals. */
export const mayHaveExamples = (ownerEmail: string) => /\.example$/i.test(ownerEmail.trim());

/** Something that happened on an example deal, so many hours ago. */
export type ExampleEvent =
  | { on: "record"; kind: "note" | "call" | "email" | "proposal" | "stage"; text: string; hoursAgo: number; sol?: boolean }
  | { on: "chat"; from: "them" | "us" | "sol"; text: string; hoursAgo: number };

export interface ExampleDeal {
  first: string;
  last: string;
  phone: string;
  suburb: string;
  postcode: string;
  stage: JobStage;
  title: string;
  value: number | null;
  kw: number | null;
  batteryKwh: number | null;
  /** Days from today; negative is past. */
  installInDays: number | null;
  /** How long ago the lead came in, hours. */
  ageHours: number;
  events: ExampleEvent[];
}

export const EXAMPLE_DEALS: ExampleDeal[] = [
  {
    first: "Priya",
    last: "Sample",
    phone: "0491 570 006",
    suburb: "Glen Waverley",
    postcode: "3150",
    stage: "proposal",
    title: "Solar and battery",
    value: 18900,
    kw: 8.3,
    batteryKwh: 16,
    installInDays: null,
    ageHours: 24 * 9,
    events: [
      { on: "record", kind: "proposal", text: "Proposal sent", hoursAgo: 72 },
      { on: "record", kind: "proposal", text: "Opened the proposal", hoursAgo: 11 },
      { on: "record", kind: "proposal", text: "Opened the proposal again", hoursAgo: 10 },
      {
        on: "chat",
        from: "them",
        text: "Does the battery fit in the garage, or does it need to go outside? We park two cars in there.",
        hoursAgo: 0.4,
      },
    ],
  },
  {
    first: "Tom",
    last: "Example",
    phone: "0491 570 156",
    suburb: "Doncaster",
    postcode: "3108",
    stage: "lead",
    title: "Solar and battery",
    value: null,
    kw: null,
    batteryKwh: null,
    installInDays: null,
    ageHours: 0.07,
    events: [
      {
        on: "record",
        kind: "note",
        text: "Enquiry from the website: bill about $480 a quarter, wants a battery for the evenings.",
        hoursAgo: 0.07,
      },
    ],
  },
  {
    first: "Hannah",
    last: "Placeholder",
    phone: "0491 570 157",
    suburb: "Ringwood",
    postcode: "3134",
    stage: "proposal",
    title: "Solar",
    value: 9400,
    kw: 6.6,
    batteryKwh: null,
    installInDays: null,
    ageHours: 24 * 19,
    events: [
      { on: "record", kind: "proposal", text: "Proposal sent", hoursAgo: 24 * 9 },
      { on: "record", kind: "email", text: "Following up on your proposal", hoursAgo: 24 * 7, sol: true },
    ],
  },
  {
    first: "Liam",
    last: "Sample",
    phone: "0491 570 158",
    suburb: "Box Hill",
    postcode: "3128",
    stage: "designed",
    title: "Solar",
    value: 9800,
    kw: 6.6,
    batteryKwh: null,
    installInDays: null,
    ageHours: 30,
    events: [
      {
        on: "record",
        kind: "call",
        text: "Spoke for 10 minutes. Wants solar only for now; tiled roof. Sending a recent bill.",
        hoursAgo: 26,
      },
      { on: "record", kind: "stage", text: "Moved to Designed", hoursAgo: 5 },
    ],
  },
  {
    first: "Mei",
    last: "Example",
    phone: "0491 570 159",
    suburb: "Balwyn",
    postcode: "3103",
    stage: "won",
    title: "Solar, battery and EV charger",
    value: 24500,
    kw: 10.4,
    batteryKwh: 24,
    installInDays: null,
    ageHours: 24 * 16,
    events: [
      { on: "record", kind: "proposal", text: "Signed the proposal", hoursAgo: 20 },
      { on: "chat", from: "them", text: "Signed! Thanks for being so patient with all our questions.", hoursAgo: 19.5 },
      { on: "chat", from: "us", text: "Thank you, Mei. We'll be in touch this week to book the install.", hoursAgo: 18 },
    ],
  },
  {
    first: "Daniel",
    last: "Placeholder",
    phone: "0491 570 110",
    suburb: "Bentleigh",
    postcode: "3204",
    stage: "proposal",
    title: "Solar and battery",
    value: 15600,
    kw: 7.1,
    batteryKwh: 13.5,
    installInDays: null,
    ageHours: 24 * 6,
    events: [
      { on: "record", kind: "proposal", text: "Proposal sent", hoursAgo: 48 },
      { on: "record", kind: "proposal", text: "Opened the proposal", hoursAgo: 30 },
      { on: "chat", from: "them", text: "Is the Solar Victoria rebate already taken off this price?", hoursAgo: 3 },
      {
        on: "chat",
        from: "sol",
        text: "Not yet: the price shown is after the federal STCs. The Solar Victoria rebate comes off once it's approved.",
        hoursAgo: 2.9,
      },
    ],
  },
  {
    first: "Sophie",
    last: "Sample",
    phone: "0491 570 313",
    suburb: "Mitcham",
    postcode: "3132",
    stage: "lead",
    title: "Solar",
    value: null,
    kw: null,
    batteryKwh: null,
    installInDays: null,
    ageHours: 50,
    events: [{ on: "record", kind: "call", text: "Left a voicemail. Will try again tomorrow morning.", hoursAgo: 22 }],
  },
  {
    first: "Arjun",
    last: "Example",
    phone: "0491 570 737",
    suburb: "Croydon",
    postcode: "3136",
    stage: "ordered",
    title: "Solar and battery",
    value: 16200,
    kw: 6.6,
    batteryKwh: 16,
    installInDays: 6,
    ageHours: 24 * 25,
    events: [
      { on: "record", kind: "stage", text: "Moved to Ordered", hoursAgo: 28 },
      { on: "record", kind: "note", text: "Network pre-approval still pending with the distributor.", hoursAgo: 6 },
    ],
  },
  {
    first: "Emily",
    last: "Placeholder",
    phone: "0491 571 266",
    suburb: "Camberwell",
    postcode: "3124",
    stage: "proposal",
    title: "Solar and battery",
    value: 21300,
    kw: 9.5,
    batteryKwh: 16,
    installInDays: null,
    ageHours: 24 * 12,
    events: [
      { on: "record", kind: "proposal", text: "Proposal sent", hoursAgo: 24 * 5 },
      {
        on: "chat",
        from: "them",
        text: "Could we do it with fewer panels on the street side? We'd like to keep the front looking clean.",
        hoursAgo: 24 * 3,
      },
      { on: "chat", from: "us", text: "Of course. We can move them all to the back roof; I'll redo the design.", hoursAgo: 24 * 3 - 2 },
    ],
  },
  {
    first: "Ben",
    last: "Sample",
    phone: "0491 571 491",
    suburb: "Blackburn",
    postcode: "3130",
    stage: "scheduled",
    title: "Solar",
    value: 10900,
    kw: 7.1,
    batteryKwh: null,
    installInDays: 1,
    ageHours: 24 * 30,
    events: [{ on: "record", kind: "note", text: "Install tomorrow. Stock collected; crew arriving 7 to 9 am.", hoursAgo: 4 }],
  },
  {
    first: "Olivia",
    last: "Example",
    phone: "0491 571 804",
    suburb: "Mount Waverley",
    postcode: "3149",
    stage: "designed",
    title: "Solar and battery",
    value: 12400,
    kw: 7.1,
    batteryKwh: 8,
    installInDays: null,
    ageHours: 40,
    events: [{ on: "record", kind: "stage", text: "Moved to Designed", hoursAgo: 20 }],
  },
  {
    first: "Noah",
    last: "Placeholder",
    phone: "0491 572 549",
    suburb: "Burwood",
    postcode: "3125",
    stage: "proposal",
    title: "Solar",
    value: 8700,
    kw: 5.9,
    batteryKwh: null,
    installInDays: null,
    ageHours: 24 * 8,
    events: [
      { on: "record", kind: "proposal", text: "Proposal sent", hoursAgo: 24 * 4 },
      { on: "record", kind: "proposal", text: "Opened the proposal", hoursAgo: 48 },
      { on: "record", kind: "email", text: "Following up on your proposal", hoursAgo: 22, sol: true },
    ],
  },
];

/** The deal's address: a made-up street with no place on the map. */
export const exampleAddress = (d: ExampleDeal, i: number) => `${i + 3} Sample Street, ${d.suburb} VIC ${d.postcode}`;
export const exampleEmail = (d: ExampleDeal) => `${d.first}.${d.last}@example.com`.toLowerCase();
