# Deploying RENUABL to Vercel

RENUABL is hosted on [Vercel](https://vercel.com). Once connected, Vercel deploys automatically:

- **Every push** to any branch gets its own preview link.
- **The production branch** (the repo's default branch) is served at the main project URL.

The repo already contains what Vercel needs:

| File                       | Purpose                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel.json`              | Runs server code in Sydney (`syd1`) — Vercel's only Australian region and ~10 ms from Melbourne, so it serves the Victorian launch market well. |
| `.github/workflows/ci.yml` | Runs typecheck, lint, tests, format check and build on every push, so broken changes are caught before deploy.                                  |
| `.env.example`             | Lists the environment variables the app reads.                                                                                                  |
| `src/lib/config.ts`        | Preview mode: blocks search engines until launch.                                                                                               |

## One-time setup (about 5 minutes)

1. Go to <https://vercel.com/signup> and choose **Continue with GitHub**. Sign in with the GitHub account that owns `RENUABL`.
2. Choose a plan. **Hobby** (free) is fine for trying it out. Vercel's Hobby plan is for non-commercial use, so switch to **Pro** before real customers use it.
3. On the dashboard, click **Add New… → Project**.
4. Under **Import Git Repository**, find `RENUABL`. If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to that repository.
5. Click **Import**. Vercel detects Next.js automatically — leave the build settings as they are.
6. Click **Deploy**. The first build takes 1–2 minutes.
7. When it finishes, you get a link like `renuabl.vercel.app`. Open it on your phone.

That's it. From then on, each push updates the site on its own.

## Useful links once deployed

- Customer experience: `/`
- My RENUABL (post-install): `/my`
- Installer portal: `/installer` (on a phone this is the field app)

## Settings to know about

**Environment variables** — Vercel → your project → **Settings → Environment Variables**.

| Variable                           | Default           | When to change                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_PREVIEW_MODE`         | on (when unset)   | `false` switches the site to live mode: search engines may index it, the fictional demo installers disappear (only Primero is matched), the installer portal returns 404 (it runs on sample data), My RENUABL is always labelled as an example, and error messages drop their preview details. Bills then need `ANTHROPIC_API_KEY` (no sample bill). It's built into the site, so redeploy after changing it.                                        |
| `NEXT_PUBLIC_HUBSPOT_MEETINGS_URL` | unset             | Your HubSpot Meetings link for the 15-minute confirmation call (HubSpot → Library → Meetings → copy link, e.g. `https://meetings.hubspot.com/your-team/confirmation-call`). Customers then book the call themselves on the confirmation screen. Until it's set, customers pick a time in RENUABL's own calendar instead; that booking is noted on the customer's HubSpot record and emailed to them with a calendar invite. Redeploy after changing. |
| `ANTHROPIC_API_KEY`                | unset             | Claude API key used to read customers' electricity bills on the "About your home" step (console.anthropic.com → API keys). Server-side only: never prefix it with `NEXT_PUBLIC_`. Without it, preview deployments use a sample bill and production shows "We can't read bills right now".                                                                                                                                                            |
| `ANTHROPIC_MODEL`                  | `claude-opus-5`   | Optional. The Claude model that reads bills.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `HUBSPOT_PRIVATE_APP_TOKEN`        | unset             | Sends every reservation (name, mobile, email, system, install date, ad source) to HubSpot as a contact with a note. HubSpot → Settings → Integrations → Private apps → Create, scopes `crm.objects.contacts.read` and `crm.objects.contacts.write`, then copy the token. Server-side only. Until it's set, reservations are only written to the Vercel logs.                                                                                         |
| `STRIPE_SECRET_KEY`                | unset             | Takes the $499 refundable deposit after the confirmation call. Stripe → Developers → API keys → Secret key (`sk_test_…` while testing, `sk_live_…` at launch). Server-side only.                                                                                                                                                                                                                                                                     |
| `STRIPE_WEBHOOK_SECRET`            | unset             | Lets Stripe confirm paid deposits (noted on the customer's HubSpot contact). Stripe → Developers → Webhooks → Add endpoint `https://<your-site>/api/stripe/webhook`, event `checkout.session.completed`, then copy the signing secret (`whsec_…`).                                                                                                                                                                                                   |
| `GOOGLE_MAPS_API_KEY`              | unset             | Real address search (Google Places API (New), Australia only) with map coordinates for each home. Google Cloud console → enable **Places API (New)** → Credentials → Create API key → restrict it to Places API (New). Server-side only. Until it's set, the address box only knows the sample addresses.                                                                                                                                            |
| `STC_PRICE`                        | `38`              | Dollars per STC your installer credits customers (ex GST). The CER doesn't publish a market price (its clearing house is fixed at $40); its homeowner guidance says $33–$38 is usual.                                                                                                                                                                                                                                                                |
| `ASK_MODEL`                        | `claude-sonnet-5` | The Claude model behind Ask RENUABL's answers (uses `ANTHROPIC_API_KEY`). Without a key, Ask RENUABL uses its built-in reviewed answers.                                                                                                                                                                                                                                                                                                             |
| `BLOB_READ_WRITE_TOKEN`            | unset             | Private file storage (Vercel Blob) for partner applications and certificates of currency, and job handover photos and serial numbers. Vercel → Storage → Create → **Blob**, choose **Private**, connect it to this project (Vercel adds the variable), then redeploy. Without it, partner applications go to HubSpot only (the certificate isn't kept), and handovers are saved on the installer's device.                                           |
| `RESEND_API_KEY`                   | unset             | Sends customer emails (order confirmation with the price breakdown and an install-day calendar invite; call booking confirmation). Create a key at resend.com → API Keys. Without it (or `EMAIL_FROM`), nothing is emailed and the confirmation screen doesn't claim it was.                                                                                                                                                                         |
| `EMAIL_FROM`                       | unset             | Sender, e.g. `RENUABL <hello@renuabl.com.au>`. The domain must be verified in Resend (Resend → Domains: add the DNS records it shows).                                                                                                                                                                                                                                                                                                               |
| `EMAIL_REPLY_TO`                   | unset             | Optional reply-to address for customer replies, e.g. your team inbox.                                                                                                                                                                                                                                                                                                                                                                                |

**Protecting previews** — to keep the site private while you test, go to **Settings → Deployment Protection** and turn on **Vercel Authentication**. Only people you invite to the Vercel team can then open it.

**Custom domain** — **Settings → Domains → Add**, enter e.g. `renuabl.com.au`, and follow the DNS instructions shown for your domain registrar.

## Going live

1. In Vercel, set `NEXT_PUBLIC_PREVIEW_MODE` to `false` (Production), check `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, `HUBSPOT_PRIVATE_APP_TOKEN` and the Stripe keys are set, then redeploy.
2. Custom domain: Vercel → Settings → Domains → add e.g. `renuabl.com.au` and `www.renuabl.com.au`, then add the DNS records Vercel shows at your domain registrar. HTTPS is automatic.
3. After the domain works, update the Stripe webhook URL to `https://<your domain>/api/stripe/webhook`, and restrict the Google key's usage alerts/budget.
4. Publish a privacy policy and terms (including the deposit's refund terms) before taking real customers' details.

## Partners

- Partner sign-up is at `/partners` (public on the live site): installers and retailers apply there. Each application goes to HubSpot (contact + note with their rates) and, with Blob storage, is kept privately with their certificate of currency under `partners/<reference>/`.
- Job handover (photos and serial numbers) is in each job in the installer portal. The portal, and saving handovers, stay preview-only until partner logins exist. Customers open their installation record from its private link (`/my/installation?record=…`).

## Production branch

Vercel serves the repository's default branch as production. The recommended setup is:

1. Create a `main` branch from the current work and make it the default branch on GitHub (**Settings → General → Default branch**).
2. In Vercel, confirm **Settings → Git → Production Branch** is `main`.
3. Do new work on feature branches; each gets a preview link, and merging to `main` updates the live site.

## Taking the deposit

Reserving is free. After the 15-minute confirmation call, send the customer their deposit link:

`https://<your-site>/deposit?ref=RN-1234&email=customer@example.com`

Use the reservation reference from the HubSpot note (the `email` part is optional and pre-fills Stripe). The customer pays on Stripe's secure page (card, Apple Pay, Google Pay) and gets a receipt from Stripe; the payment is noted on their HubSpot contact. Refunds are made from the Stripe dashboard. Test with card 4242 4242 4242 4242, any future expiry and any CVC while using a `sk_test_` key.
