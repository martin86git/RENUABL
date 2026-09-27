/**
 * Stripe's embedded checkout form for the deposit. Stripe.js is always loaded
 * straight from js.stripe.com (never bundled), and only on the deposit page.
 */
import { STRIPE_PUBLISHABLE_KEY } from "@/lib/config";

const STRIPE_JS = "https://js.stripe.com/dahlia/stripe.js";

/** The configured look of the payment form. */
export const STRIPE_APPEARANCE = {
  theme: "stripe",
  labels: "auto",
  inputs: "spaced",
  variables: {
    borderRadius: "4px",
    colorBackground: "#ffffff",
    colorDanger: "#df1b41",
    colorPrimary: "#0570de",
    colorSuccess: "#00c853",
    colorText: "#30313d",
    fontFamily: "Be Vietnam Pro",
    fontSizeBase: "14px",
    spacingUnit: "4px",
  },
} as const;

interface CheckoutForm {
  mount(selector: string | HTMLElement): void;
  unmount?(): void;
  destroy?(): void;
  on(event: "confirm", handler: (event: unknown) => void): void;
}
interface CheckoutFormSdk {
  createForm(opts: { layout: "expanded" }): CheckoutForm;
  loadActions(): Promise<
    { type: "success"; actions: { confirm(opts: { formConfirmEvent: unknown }): Promise<unknown> } } | { type: "error"; error?: unknown }
  >;
}
type StripeFactory = (
  key: string,
  opts: { betas: string[] },
) => {
  initCheckoutFormSdk(opts: { clientSecret: Promise<string> | string; appearance: typeof STRIPE_APPEARANCE }): CheckoutFormSdk;
};

let loading: Promise<StripeFactory> | null = null;

function loadStripeJs(): Promise<StripeFactory> {
  const w = window as unknown as { Stripe?: StripeFactory };
  if (w.Stripe) return Promise.resolve(w.Stripe);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = STRIPE_JS;
    script.async = true;
    script.onload = () => (w.Stripe ? resolve(w.Stripe) : reject(new Error("Stripe.js didn't load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Stripe.js didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function stripeFormAvailable() {
  return Boolean(STRIPE_PUBLISHABLE_KEY);
}

/**
 * Mounts the payment form into `el`. On confirm, Stripe takes the payment and
 * sends the customer to the session's return page. Returns a clean-up function.
 */
export async function mountDepositForm(el: HTMLElement, clientSecret: Promise<string>, onError: (message: string) => void) {
  if (!STRIPE_PUBLISHABLE_KEY) throw new Error("Stripe publishable key isn't set");
  const Stripe = await loadStripeJs();
  const stripe = Stripe(STRIPE_PUBLISHABLE_KEY, { betas: ["custom_checkout_payment_form_1"] });
  const checkout = stripe.initCheckoutFormSdk({ clientSecret, appearance: STRIPE_APPEARANCE });
  const form = checkout.createForm({ layout: "expanded" });
  form.mount(el);
  const loaded = await checkout.loadActions();
  if (loaded.type === "success") {
    form.on("confirm", async (event) => {
      try {
        await loaded.actions.confirm({ formConfirmEvent: event });
      } catch (error) {
        console.error("Payment confirmation error:", error);
        onError("Your payment didn't go through. Please check your details and try again.");
      }
    });
  } else {
    onError("We couldn't open the payment form just now. Please try again.");
  }
  return () => {
    form.destroy?.();
  };
}
