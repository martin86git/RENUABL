# RENUABL Business: go-to-market plan and draft emails (for Martin's review)

Drafts only. Nothing here has been sent, scheduled or put into the product yet.

> **22 Nov 2026: the emails below are replaced** by the "One giant leap" launch series in [launch-strategy.md](launch-strategy.md), which is what Add the drafts now puts into Marketing. The send checklist and warm-up here still stand.

## Before anything is sent

1. **Consent of the bought list.** Confirm what consent the list carries. Contacts without express or inferred consent are imported as "Not checked" and are never emailed. Nothing goes out until this is answered.
2. **/business is still hidden** (`BUSINESS_LINK_SHOWN` is false: noindex, kept out of search). Every email links there, so decide whether it flips to true before the first send.
3. **Sender domain.** A sending subdomain (for example `mail.renuabl.com.au`) authenticated on SendGrid or Resend: SPF, DKIM and a DMARC record (start at `p=none`, move to `quarantine` once reports are clean). Set `EMAIL_FROM` to it. _Martin, in the DNS and the email provider._
4. **Live settings:** `CRON_SECRET`, `SITE_URL`, and the provider's event webhook pointed at `/api/m/events` with its secret. Marketing → Settings shows what is missing. _Martin, on Vercel._
5. **Brand kit:** Settings → Branding has RENUABL's name, ABN, an email or phone and the address (they go in every footer).
6. **Seed tests:** Send a test of each email to your own Gmail and Outlook addresses. Check the inbox it lands in, the pictures, the links and the unsubscribe. _The product sends the test (Send a test); you check it._

## Warm-up (the daily cap in Marketing → Settings)

| Days | Daily cap                                                                   | Who                                                                   |
| ---- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1–3  | 50                                                                          | The most engaged-looking contacts first (named people with a company) |
| 4–7  | 100                                                                         |                                                                       |
| 8–14 | 200                                                                         |                                                                       |
| 15+  | 300 (default), up only while bounces stay under 2% and complaints near zero |                                                                       |

The product sends only on working days, 9 am to 5 pm Melbourne time, 100 at a time each hour, never past the cap, and never while paused.

## Segments (lists in Contacts)

- **Retailers** and **Installers**: from the sheet's role or company column where it says so; anyone unclear goes to **Solar businesses**.
- By **state** (the sheet's State column): Victoria first.
- A **Mobile** list is possible later; it is not used for email.

## Timing and stops

- **Week 1:** the launch email, sent as a campaign to one segment at a time, warm-up caps applied.
- **From the day after:** the nurture sequence (below), triggered by "opened the launch campaign": four emails over about three weeks, working days only.
- **Stops (automatic):** signing up to RENUABL Business, unsubscribing, bouncing, or consent removed. Tick "a click ends it" if you want to take over by phone after any click.

## What to watch, and when to pause

- **Bounce rate over 3%** or **any spam complaints above a handful**: press Pause in Settings and clean the list.
- **Open rate** under 15% after the first 500: change the subject line (Sol can write alternatives).
- **Clicks and sign-ups:** who engaged is listed on each campaign's report; ring the clickers.

## Who does what

| Step                                                | Martin         | The product                          |
| --------------------------------------------------- | -------------- | ------------------------------------ |
| Consent answer, DNS, provider, Vercel settings      | ✓              |                                      |
| Import, lists, consent per contact                  | ✓ (once)       | keeps it, never emails "Not checked" |
| Writing and editing the emails                      | ✓ reviews      | Sol drafts on request                |
| Sending hours, caps, batches, unsubscribes, bounces |                | ✓                                    |
| Sequence steps and stops                            | switches it on | ✓                                    |
| Reading reports, pausing                            | ✓              | shows them                           |

---

## Launch email (campaign)

**Subject:** Solar just got a brain
**Preview:** RENUABL Business: design, CRM, proposals and service in one platform, with AI built in.

**Heading:** Solar just got a brain.

Hi {firstName},

RENUABL Business is the all-in-one platform for solar businesses, with AI built into every part of it.

Draw a roof and it's priced as you draw. Send a branded proposal your customer can accept online. Once it's signed, ordering, the install calendar, installer job cards and the paperwork after the install are all in the same place.

Sol, RENUABL's built-in AI, works inside your deals. He tells you who to ring next, drafts the follow-up in your voice and answers questions on solar and the standards, with his sources. He never sends anything himself: you check, you send.

It's $49 a user a month, and your first month is free. Prices include GST. Cancel any time.

**Button:** See RENUABL Business → https://www.renuabl.com.au/business

## Nurture sequence (triggered by opening the launch email)

**1 · after 2 working days**
Subject: A design tool that designs itself
Preview: Ask for 8 kW and a battery, or press once for three designs.
Heading: Three designs. One press.
Hi {firstName}, ask the designer for 8 kW and a battery, or press once and it lays out three designs for the roof, each priced as it's drawn, with strings checked against the inverter. You check it against the photo and send the one you like.
Button: Book a demo → https://www.renuabl.com.au/?demo=1

**2 · after 4 more working days**
Subject: Your CRM, doing the typing
Preview: Calls written up, follow-ups drafted, the next deal to ring.
Heading: A CRM that keeps itself up to date.
Hi {firstName}, the note-taker writes up your calls into the deal. Sol drafts the follow-up when a proposal is due one, and Today shows which deals need you and why. Your team chats on each deal; your customers never see it.
Button: See how it works → https://www.renuabl.com.au/business

**3 · after 5 more working days**
Subject: After the signature
Preview: Ordering, install calendar, job cards and paperwork in one place.
Heading: Signed. Then it runs.
Hi {firstName}, when a customer accepts, the order opens with the exact lines sold, the install goes on the calendar, and your installer gets a job card with the layout and strings. Invoices, STCs and grid connection are tracked to the end, and service cases after that.
Button: See RENUABL Business → https://www.renuabl.com.au/business

**4 · after 5 more working days**
Subject: One price for {company}
Preview: $49 a user a month, first month free. Cancel any time.
Heading: One price a user. Then pay as you go.
Hi {firstName}, every user gets the same CRM, proposals, after the sale, service and Sol, with no feature tiers. The designer is paid for by the site, and voice agents and marketing email are added when you want them. $49 a user a month, or $39 a user a month on the 12-month plan. Your first month is free. Prices include GST, and you can cancel any time.
Button: Sign up → https://www.renuabl.com.au/business#pricing

---

Checked against the house rules: no competitor named, no best, first, leading or guaranteed, prices as on /business and never shown as a discount, only {firstName} and {company}.

**To put them in the product:** on RENUABL's own business, open Marketing → Campaigns and press **Add the drafts** (RENUABL Business go-to-market). It adds "RENUABL Business launch" as a draft campaign and "RENUABL Business nurture" as a sequence that stays off, started by opening the launch email once switched on. Nothing is sent or scheduled. The words live in `src/lib/domain/marketing/gtm-drafts.ts`; keep this page in step with them.
