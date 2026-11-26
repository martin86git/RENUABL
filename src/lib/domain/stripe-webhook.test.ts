import { describe, expect, it } from "vitest";
import { webhookSecrets } from "./stripe-webhook";

describe("the webhook's signing secrets", () => {
  it("takes both variables, several in one, and forgives quotes and spaces", () => {
    expect(webhookSecrets(' "whsec_a" ', "whsec_b, whsec_c")).toEqual(["whsec_a", "whsec_b", "whsec_c"]);
    expect(webhookSecrets(undefined, "")).toEqual([]);
  });
});
