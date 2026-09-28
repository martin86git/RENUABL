import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { depositCents, parseReference } from "@/lib/domain/deposit";
import { createDepositCheckout, createHostedDepositCheckout } from "./stripe";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("deposit", () => {
  it("accepts only reservation references", () => {
    expect(parseReference(" rn-1234 ")).toBe("RN-1234");
    expect(parseReference("RN-12")).toBeNull();
    expect(parseReference("hello")).toBeNull();
    expect(depositCents()).toBe(49900);
  });

  it("creates an embedded-form Checkout Session for $499 AUD with the reservation attached", async () => {
    const create = vi.fn(async (params: Stripe.Checkout.SessionCreateParams) => {
      void params;
      return { client_secret: "cs_test_secret" };
    });
    const fake = { checkout: { sessions: { create } } } as unknown as Stripe;
    const secret = await createDepositCheckout(fake, { reference: "RN-1234", email: "sarah@example.com", origin: "https://renuabl.test" });
    expect(secret).toBe("cs_test_secret");
    const params = create.mock.calls[0][0];
    expect(params.mode).toBe("payment");
    expect(params.line_items![0].price_data).toMatchObject({ currency: "aud", unit_amount: 49900 });
    expect(params.metadata).toEqual({ reference: "RN-1234", kind: "deposit" });
    expect(params.customer_email).toBe("sarah@example.com");
    expect(params).toMatchObject({
      ui_mode: "form",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      submit_type: "book",
      shipping_address_collection: { allowed_countries: ["AU"] },
      locale: "en-GB",
      integration_identifier: "custom_embedded_web_0002",
    });
    expect(params.payment_method_collection).toBeUndefined();
    expect(params.success_url).toBeUndefined();
    expect(params.return_url).toBe("https://renuabl.test/deposit/paid?ref=RN-1234&session_id={CHECKOUT_SESSION_ID}");
  });
});

describe("hosted backup", () => {
  it("opens Stripe's own page with the same deposit, reservation and settings", async () => {
    const create = vi.fn(async (params: Stripe.Checkout.SessionCreateParams) => {
      void params;
      return { url: "https://checkout.stripe.com/c/pay/cs_test" };
    });
    const fake = { checkout: { sessions: { create } } } as unknown as Stripe;
    const url = await createHostedDepositCheckout(fake, { reference: "RN-1234", email: null, origin: "https://renuabl.test" });
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test");
    const params = create.mock.calls[0][0];
    expect(params.ui_mode).toBeUndefined();
    expect(params).toMatchObject({
      mode: "payment",
      submit_type: "book",
      locale: "en-GB",
      metadata: { reference: "RN-1234", kind: "deposit" },
    });
    expect(params.line_items![0].price_data).toMatchObject({ currency: "aud", unit_amount: 49900 });
    expect(params.success_url).toBe("https://renuabl.test/deposit/paid?ref=RN-1234&session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toBe("https://renuabl.test/deposit?ref=RN-1234");
  });
});

describe("Stripe webhook", () => {
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({
    id: "evt_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        object: "checkout.session",
        metadata: { reference: "RN-1234" },
        amount_total: 49900,
        payment_status: "paid",
        customer_details: { email: "sarah@example.com" },
      },
    },
  });
  const request = (signature: string) =>
    new Request("https://renuabl.test/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } });

  it("accepts a correctly signed event and rejects a forged one", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "");
    const signature = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret });
    expect((await webhook(request(signature))).status).toBe(200);
    expect((await webhook(request("t=1,v1=forged"))).status).toBe(400);
  });

  it("notes the paid deposit on the customer's HubSpot contact", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    vi.stubEnv("HUBSPOT_PRIVATE_APP_TOKEN", "tok");
    const fetchMock = vi.fn<typeof fetch>(async (url) =>
      String(url).includes("/notes") ? Response.json({ id: "n1" }, { status: 201 }) : Response.json({ id: "101" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const signature = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret });
    expect((await webhook(request(signature))).status).toBe(200);
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls[0]).toContain("/contacts/sarah%40example.com?idProperty=email");
    expect(urls[1]).toContain("/notes");
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string).properties.hs_note_body).toContain("Deposit paid");
  });
});
