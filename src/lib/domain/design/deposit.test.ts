import { describe, expect, it } from "vitest";
import { depositSaidEmail } from "../emails";
import { PAY_LINK_WRONG, cleanBrandKit, cleanPayLink, defaultBrand } from "./brand";
import {
  PAID_WAY_WRONG,
  cardNote,
  cleanPaid,
  customerStandingWords,
  depositAsked,
  depositBasis,
  depositStanding,
  depositStatus,
  isReference,
  markedNotReceived,
  markedReceived,
  money,
  newReference,
  noWayToPay,
  publicDeposit,
  saidPaid,
  standingWords,
  waysToPay,
  type DepositRecord,
} from "./deposit";
import { COST_WORDS, buildProposal, depositOf } from "./proposal";
import { sampleBrand, sampleInputs } from "./proposal-fixture";

const NOTHING: DepositRecord = { reference: null, saidWay: null, saidAt: null, receivedAt: null, receivedBy: null };
const BANK = { name: "Example Solar Pty Ltd", bsb: "063000", number: "12345678", reference: "" };
const day = (iso: string) => iso.slice(0, 10);

/** A proposal worked out with the business's payment settings as given. */
function proposal(brand: Partial<ReturnType<typeof sampleBrand>> = {}, over: Parameters<typeof sampleInputs>[0] = {}) {
  const built = buildProposal(sampleInputs({ ...over, brand: { ...sampleBrand(), ...brand } }));
  if (!built.ok) throw new Error(built.problems.join(" "));
  return built;
}

describe("the deposit a proposal asks for", () => {
  it("is nothing when the business asks for none", () => {
    expect(depositOf({ kind: "none", amount: 0 }, 11454)).toBeNull();
    const { view } = proposal();
    expect(view.terms?.deposit).toBeNull();
    expect(depositAsked(view)).toBeNull();
    // No deposit, no prompt: not before the proposal is accepted, and not after.
    expect(depositStatus(view, false, NOTHING)).toBeNull();
    expect(depositStatus(view, true, NOTHING)).toBeNull();
    expect(publicDeposit(depositStatus(view, true, NOTHING))).toBeNull();
  });
  it("is a share of what the customer pays, to the cent", () => {
    expect(depositOf({ kind: "percent", amount: 10 }, 11454)).toBe(1145.4);
    expect(depositOf({ kind: "percent", amount: 20 }, 11454)).toBe(2290.8);
    expect(depositOf({ kind: "percent", amount: 12.5 }, 11455)).toBe(1431.88);
    expect(depositOf({ kind: "percent", amount: 33.3 }, 9999)).toBe(3329.67);
    expect(depositOf({ kind: "percent", amount: 100 }, 11454)).toBe(11454);
    // Never a figure with a long tail.
    for (const percent of [1, 7.5, 12.5, 33.3, 66.6]) {
      const amount = depositOf({ kind: "percent", amount: percent }, 11_457)!;
      expect(Math.round(amount * 100) / 100).toBe(amount);
    }
  });
  it("is the set amount, and never more than the whole price", () => {
    expect(depositOf({ kind: "fixed", amount: 500 }, 11454)).toBe(500);
    expect(depositOf({ kind: "fixed", amount: 50_000 }, 11454)).toBe(11454);
  });
  it("is worked out from the price that stands without the Solar Victoria rebate", () => {
    const { view } = proposal({ deposit: { kind: "percent", amount: 10 } });
    expect(view.terms?.deposit).toBe(depositOf({ kind: "percent", amount: 10 }, view.price.youPay));
    expect(depositBasis(view)).toBe(`Worked out from the price you pay, ${money(view.price.youPay)}.`);
    // With Solar Victoria on the quote, the lower price is never what the deposit is a share of, and the page says which.
    const after = view.price.youPay - 1400;
    const solarVic = { rebate: 1400, loan: 0, loanMonths: 0, monthly: 0, afterRebate: after, upfront: after, note: "" };
    const withRebate = { price: { ...view.price, solarVic } };
    expect(depositBasis(withRebate)).toMatch(/the price without the Solar Victoria rebate, which is what stands if that isn't approved\.$/);
    expect(depositBasis(withRebate)).toContain(money(view.price.youPay));
    expect(depositBasis(withRebate)).not.toContain(money(after));
  });
  it("is asked for only once the proposal is accepted", () => {
    const { view } = proposal({ deposit: { kind: "fixed", amount: 500 } });
    expect(depositStatus(view, false, NOTHING)).toBeNull();
    expect(depositStatus(view, true, NOTHING)).toMatchObject({ amount: 500, standing: "due", way: null });
  });
  it("is written with its cents when it has any", () => {
    expect(money(1145.4)).toBe("$1,145.40");
    expect(money(500)).toBe("$500");
    expect(money(11454)).toBe("$11,454");
    expect(money(0.5)).toBe("$0.50");
  });
});

describe("where a deposit stands", () => {
  const { view } = proposal({ deposit: { kind: "fixed", amount: 500 }, bank: BANK });
  const said: DepositRecord = { ...NOTHING, reference: "K7M2QX4P", saidWay: "bank", saidAt: "2026-10-12T01:00:00.000Z" };
  const received: DepositRecord = { ...said, receivedAt: "2026-10-13T01:00:00.000Z", receivedBy: "sam@example-solar.test" };

  it("is due, then said by the customer to be paid, then received when the business says so", () => {
    expect(depositStanding(NOTHING)).toBe("due");
    expect(depositStanding(said)).toBe("said");
    expect(depositStanding(received)).toBe("received");
    // Received with nothing said (paid some other way) is still received.
    expect(depositStanding({ saidAt: null, receivedAt: "2026-10-13T01:00:00.000Z" })).toBe("received");
  });
  it("never reads as received because a customer said they paid", () => {
    const status = depositStatus(view, true, said)!;
    expect(status.standing).toBe("said");
    expect(status.receivedAt).toBeNull();
    for (const words of [
      standingWords(status, day),
      customerStandingWords(publicDeposit(status)!, "Example Solar", day)!,
      saidPaid("bank", 500, "K7M2QX4P"),
      saidPaid("card", 500, null),
    ]) {
      expect(words).not.toMatch(/received|paid in full|payment confirmed|has your deposit|thank you/i);
      expect(words).toMatch(/says they paid|told Example Solar/);
    }
    expect(standingWords(status, day)).toMatch(/Not confirmed: check your account\.$/);
    expect(saidPaid("bank", 500, "K7M2QX4P")).toBe(
      "The customer says they paid the deposit of $500 by bank transfer (reference K7M2QX4P). Not confirmed: check your account.",
    );
    // The email to the business says the same: what the customer said, not a payment.
    const email = depositSaidEmail({
      business: "Example Solar",
      customer: "Alex Example",
      title: "Solar",
      way: "bank",
      reference: "K7M2QX4P",
      link: "https://www.renuabl.com.au/design/deals/job_1",
    });
    expect(email.subject).toBe("Alex Example says they've paid their deposit");
    expect(email.text).toMatch(/not confirmation of a payment/);
    expect(email.text).toContain("K7M2QX4P");
    expect(email.text).not.toMatch(/deposit (was|has been) (paid|received)/i);
  });
  it("says so plainly once the business has it", () => {
    const status = depositStatus(view, true, received)!;
    expect(standingWords(status, day)).toBe("Deposit of $500 received on 2026-10-13");
    expect(customerStandingWords(publicDeposit(status)!, "Example Solar", day)).toBe("Example Solar has your deposit of $500. Thank you.");
    expect(standingWords(depositStatus(view, true, NOTHING)!, day)).toBe("Deposit of $500 due");
    expect(customerStandingWords(publicDeposit(depositStatus(view, true, NOTHING))!, "Example Solar", day)).toBeNull();
    expect(markedReceived(500)).toBe("Deposit of $500 marked received");
    expect(markedNotReceived(1145.4)).toBe("Deposit of $1,145.40 marked not received: it is due again");
  });
  it("shows the customer where it stands, and never who at the business marked it", () => {
    const sent = publicDeposit(depositStatus(view, true, received));
    expect(sent).toEqual({ amount: 500, reference: "K7M2QX4P", standing: "received", way: "bank", saidAt: "2026-10-12T01:00:00.000Z" });
    expect(JSON.stringify(sent)).not.toContain("sam@example-solar.test");
    const keys = new Set<string>();
    JSON.stringify(sent, (key, value) => (keys.add(key.toLowerCase()), value));
    for (const word of [...COST_WORDS, "receivedBy", "email"]) expect(keys.has(word.toLowerCase())).toBe(false);
  });
  it("leaves the business's costs out of everything a proposal with a deposit sends the customer", () => {
    const { view: sent, internal } = proposal({
      deposit: { kind: "percent", amount: 10 },
      bank: BANK,
      payLink: "https://pay.example.com/alpha",
    });
    const keys: string[] = [];
    JSON.stringify(sent, (key, value) => (keys.push(key.toLowerCase()), value));
    for (const word of COST_WORDS) expect(keys).not.toContain(word.toLowerCase());
    for (const secret of [internal.cost, internal.margin, internal.priceExGst]) expect(JSON.stringify(sent)).not.toContain(String(secret));
    expect(sent.terms?.payLink).toBe("https://pay.example.com/alpha");
  });
});

describe("the ways to pay", () => {
  it("are the account and the payment page the proposal was sent with", () => {
    expect(waysToPay(proposal({ deposit: { kind: "fixed", amount: 500 } }).view)).toEqual([]);
    expect(waysToPay(proposal({ bank: BANK }).view)).toEqual(["bank"]);
    expect(waysToPay(proposal({ payLink: "https://pay.example.com/alpha" }).view)).toEqual(["card"]);
    expect(waysToPay(proposal({ bank: BANK, payLink: "https://pay.example.com/alpha" }).view)).toEqual(["bank", "card"]);
    expect(noWayToPay("Example Solar")).toBe("Example Solar will be in touch about how to pay the deposit.");
  });
  it("say whose page a card is paid on", () => {
    expect(cardNote("Example Solar")).toMatch(
      /Example Solar's own payment page in a new tab\. You pay Example Solar there: no card details are taken on this page\./,
    );
  });
  it("take only a way this proposal offers", () => {
    const bankOnly = proposal({ bank: BANK }).view;
    expect(cleanPaid({ way: "bank" }, bankOnly)).toEqual({ ok: true, value: { way: "bank" } });
    expect(cleanPaid({ way: "card" }, bankOnly)).toEqual({ ok: false, message: PAID_WAY_WRONG });
    for (const raw of [null, {}, { way: "cash" }, { way: 1 }, "bank"])
      expect(cleanPaid(raw, bankOnly)).toEqual({ ok: false, message: PAID_WAY_WRONG });
  });
  it("give each deal a short reference that says nothing of its link", () => {
    const reference = newReference(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 9, 9]));
    expect(reference).toHaveLength(8);
    expect(isReference(reference)).toBe(true);
    // No letters or digits that are mistaken for each other.
    for (let byte = 0; byte < 256; byte++) expect(newReference(new Uint8Array(8).fill(byte))).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    for (const bad of ["", "abcdefgh", "ABCDEFG", "ABCDEFGHJ", "ABCDEFG0", "ABCDEFGI", null, 12345678])
      expect(isReference(bad)).toBe(false);
  });
});

describe("a business's card payment link", () => {
  it("is kept as a full https address, or left empty", () => {
    expect(cleanPayLink("https://pay.example.com/alpha?x=1")).toBe("https://pay.example.com/alpha?x=1");
    expect(cleanPayLink("  https://buy.example.com.au/b/abc123  ")).toBe("https://buy.example.com.au/b/abc123");
    expect(cleanPayLink("pay.example.com/alpha")).toBe("https://pay.example.com/alpha");
    expect(cleanPayLink("")).toBe("");
    expect(cleanPayLink("   ")).toBe("");
    expect(cleanPayLink(undefined)).toBe("");
  });
  it("is refused when it isn't https, or isn't a web address at all", () => {
    for (const bad of [
      "http://pay.example.com/alpha",
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://pay.example.com",
      "mailto:pay@example.com",
      "//pay.example.com",
      "https://",
      "https://localhost/pay",
      "https://pay.localhost/x",
      "https://192.168.1.10/pay",
      "https://user:secret@pay.example.com",
      "https://pay.example.com/a b",
      "just some words",
      "pay",
      "<script>",
      `https://pay.example.com/${"x".repeat(400)}`,
      5,
      {},
      ["https://pay.example.com"],
    ])
      expect(cleanPayLink(bad)).toBeNull();
  });
  it("is saved with the business's other payment settings, and a wrong one changes nothing", () => {
    const start = defaultBrand("Example Solar");
    expect(start.payLink).toBe("");
    const kept = cleanBrandKit({ payLink: "https://pay.example.com/alpha" }, start);
    expect(kept.ok && kept.value.payLink).toBe("https://pay.example.com/alpha");
    expect(cleanBrandKit({ payLink: "http://pay.example.com" }, start)).toEqual({ ok: false, message: PAY_LINK_WRONG });
    expect(cleanBrandKit({ payLink: "javascript:alert(1)" }, start)).toEqual({ ok: false, message: PAY_LINK_WRONG });
    // Not sent, it stays as it was; sent empty, it is taken away.
    const later = cleanBrandKit({ tagline: "x" }, kept.ok ? kept.value : start);
    expect(later.ok && later.value.payLink).toBe("https://pay.example.com/alpha");
    const cleared = cleanBrandKit({ payLink: "" }, kept.ok ? kept.value : start);
    expect(cleared.ok && cleared.value.payLink).toBe("");
  });
});
