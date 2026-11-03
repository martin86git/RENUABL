# RENUABL cold sales sequence (8 emails, 30 days)

For about 2,500 Australian solar retailers and installers. One idea and one button per email: **Start your 14-day free trial** → `https://www.renuabl.com.au/design` (with `utm_source=edm`, `utm_campaign=cold-sequence-2026-11` and `utm_content=email-01` … `email-08`, so HubSpot's ad source shows where a trial came from).

- `01.html` … `08.html`: the finished emails (600px tables, inline styles, Outlook button in VML, Inter with Arial fallbacks, a hidden preheader, alt text on every image).
- `build.mjs`: the copy and the template. Change the words there and run `node docs/marketing/edm/build.mjs` from the repo root. Don't run Prettier on the HTML: it rewrites Outlook's conditional comments and breaks the button. **Before anyone commits, add `docs/marketing/edm/*.html` to the root `.prettierignore`**, or `npm run format:check` fails.
- Funnel and trial emails: `../funnel.md`.

## Before the first send

1. **Product shots.** Emails 1, 3, 4 and 6 each show one real screen with made-up example data: `today`, `deals`, `sol` and `calendar`, from `public/design/landing/`; email 4 also shows `sol-garage-wall` (a real answer from Sol on battery clearances in the team chat, taken by `tools/demo/shoot.mjs sol-garage-wall` from the demo business's Installations channel; VERIFY its figures against AS/NZS 5139 before sending). The site's own copies are 2880×1800 WebP, which Outlook for Windows and some other clients don't show, so the emails load JPEG copies (`<name>.jpg`, 1040×650, 30–55 KB, made with sharp) from `https://www.renuabl.com.au/design/landing/`. **They only load once that folder is deployed to the live site**: check each URL opens before the first send. Emails 2, 5, 7 and 8 have no picture (there's no screenshot of Design it for me or the marketplace yet; add one to `build.mjs` as an `img` block when there is). If the shots are retaken, make the JPEGs again.
2. **Unsubscribe.** Every footer has `{{unsubscribe}}`. In HubSpot, replace it with the unsubscribe link token (Insert → Personalisation → Unsubscribe link) or use HubSpot's own footer and delete ours, keeping our "why you're getting this" line and the ABN.
3. **Check the trial wording against the live sign-up.** Every email says, as the sign-up page does (`PLAN_WORDS.trialExplained`): "14 days free, with 5 design jobs on us. Your card is taken on Stripe's secure page and nothing is charged until the trial ends. Cancel any time before then and you pay nothing." Check it still matches the page before sending. If it changes, change `TRIAL_TERMS` in `build.mjs`.
4. **Check the competitor figures** again on the day of the first send. They're described as a well-known Australian solar platform's published pricing, read on 1 November 2026 (the same words as the sign-up page). If the date moves, update `COMPETITOR_SOURCE`. Never name them.
5. **Sign-off and sender.** Send from a real person (e.g. "Martin at RENUABL") with a monitored reply-to: emails 2, 7 and 8 ask for replies (enterprise, MARKETPLACE).
6. **Test render** in Litmus or Email on Acid (or HubSpot's preview) across Outlook 2016/365 for Windows, Gmail web and app, Apple Mail on iPhone and Mac.

## The sequence

Who gets each one: everyone on the list who hasn't unsubscribed, bounced, replied or **started a trial**. Anyone who starts a trial leaves this sequence straight away and moves to the trial emails in `funnel.md`. Anyone who replies is taken out and answered by a person.

| #   | Send day | Angle                                  | Subject (A)                                    | Subject (B)                                                  | Preview text                                                                           | Goal                                     | The one metric                                                           |
| --- | -------- | -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Day 0    | The punch: old prices for old software | Still paying old prices for old software?      | Your solar software charges you per signature                | A fee for every project. A fee for every signature. There's another way.               | Get opened, get remembered               | Open rate (for subject testing; treat with care, Apple Mail inflates it) |
| 2   | Day 3    | The price                              | $29. Not $49 plus fees.                        | We did the maths on your software bill                       | Same team, same month, side by side. The numbers are below.                            | Make the saving concrete                 | Click rate                                                               |
| 3   | Day 6    | One deal, start to finish              | One deal, start to finish, in one place        | Lead to grid connection. No re-typing.                       | Follow one job from the first call to the last tick. Nothing typed twice.              | Show it's one system, not a bolt-on      | Click rate                                                               |
| 4   | Day 10   | Sol                                    | You already use ChatGPT. Put it in your deals. | Meet Sol. He drafts. You send.                               | Stop pasting customer notes into a chat window. Sol already knows the deal.            | Hook the people already using AI at work | Click rate                                                               |
| 5   | Day 14   | Design it for me                       | Draw the roof. Get three designs.              | Fastest payback, best return, most independence. One button. | Press Design it for me and get three priced designs for the same roof.                 | Sell the designer, the strongest demo    | Trial starts                                                             |
| 6   | Day 18   | After the sale runs itself             | Signed. Then it runs itself.                   | That 9pm admin shift just got shorter                        | The moment a customer signs, the order, the booking and the paperwork start moving.    | Reach owners and office managers         | Trial starts                                                             |
| 7   | Day 23   | Coming soon and the marketplace        | What's coming to RENUABL (and a marketplace)   | Installers bidding on your overflow jobs?                    | HubSpot, Pipedrive and Nearmap are on the way. And a marketplace for solar businesses. | Show momentum; collect interest          | Replies saying MARKETPLACE                                               |
| 8   | Day 30   | Last call: bring the team              | Last one. Bring the team.                      | 14 days free. Everyone in.                                   | This is the last email in this series. 14 days free for your whole team.               | Final conversion, then stop              | Trial starts                                                             |

A/B: test the subject on email 1 at 2 × 10% of the first day's batch, send the winner to the rest. For later emails, split the whole send 50/50 and judge on clicks, not opens.

Sequence-level numbers to watch: **trial starts per 1,000 delivered** (the real goal), bounce rate (stop and clean the list above 3%), spam complaints (stop above 0.1%), unsubscribes (expect 1–3% an email on a cold list; above 5% means the list or the message is wrong).

### Claims checked in the copy

- No "best", "first", "#1", "leading", "guaranteed" or "AI-powered".
- The competitor is "a well-known Australian solar platform", with its published prices, the date read, and a note that we didn't adjust their GST. The worked example (5 users, 40 jobs, 15 signed: $265 against $417+) uses their lowest published rates and says so.
- RENUABL isn't free per job: the design tool is $3 a job in token packs, and email 2 says so. "No fee per signature" is the claim.
- Coming-soon items (HubSpot, Pipedrive, Nearmap, automatic proposals from Nearmap) carry a "Coming soon" badge. The marketplace is offered as register-your-interest (reply MARKETPLACE).
- Design it for me and the savings are "estimates" you check before they go to a customer. Sol "never sends anything himself".
- "Solar Victoria" appears in email 3 as an example; the list is national. If the list is split by state, consider a non-Victorian version of that line.

## Sending it through HubSpot

**Read this first: HubSpot's Acceptable Use Policy doesn't allow marketing email to purchased, rented or scraped lists, or to people who haven't agreed to hear from you.** Sending 2,500 cold addresses through Marketing Hub email risks the account being suspended, and RENUABL's homeowner leads and alerts go through the same HubSpot portal (account 443761924). Pick one:

- **Recommended: HubSpot Sales Hub sequences from a separate sending domain.** Sequences send one-to-one from a connected inbox, within HubSpot's per-inbox daily limits. Use a separate domain or subdomain for cold outreach (e.g. `try-renuabl.com.au` or `go.renuabl.com.au`) so a bad week can't hurt `renuabl.com.au`, which sends customer and sign-in emails. Sequences favour plain text: paste the copy without the design for emails 1–4 and test whether the designed versions do better for 5–8.
- **Or a dedicated cold-email tool** on that separate domain, with replies and unsubscribes synced back into HubSpot.
- **Marketing Hub email** only for contacts who have opted in (e.g. trial sign-ups, webinar or event lists). That's where the trial emails in `funnel.md` belong.

### List import

1. Clean first: one row per business, remove role addresses that bounce often (`noreply@`, `admin@` on parked domains), run the list through a verifier (NeverBounce, ZeroBounce) and drop anything not "valid".
2. Columns: email, first name (if known), business name, state, website, **where the address was published** (URL) and the date it was collected. Keep that last column: it's your evidence for inferred consent (below).
3. Import into HubSpot as **non-marketing contacts** unless and until they opt in, with a property `cold_list = edm-2026-11` and a lifecycle stage of Lead. Set `utm_source=edm` links so trial sign-ups match back.
4. Make an active list "Cold sequence: eligible" = `cold_list` is `edm-2026-11` AND not unsubscribed AND not bounced AND **has not started a trial** (once trial sign-ups reach HubSpot) AND has not replied. Enrol from that list; re-check it before every send.

### Unsubscribes

- Every email has a working unsubscribe link and the text "Not for you? Unsubscribe and you won't get any more."
- Replies saying "stop", "remove", "unsubscribe" or similar count too: unsubscribe them by hand the same day.
- Honour every unsubscribe across **all** RENUABL email (sequences, marketing, any other tool), within 5 working days at the latest (the Spam Act's limit; aim for immediately).
- The link must keep working for at least 30 days after the email was sent.

### Warming up the sending domain

2,500 cold B2B addresses from a new domain, sent all at once, will land in spam. Plan on about three weeks to reach full volume:

1. Set up SPF, DKIM and DMARC (start `p=none` with reports, move to `quarantine` once clean) for the sending domain, plus a custom tracking domain in HubSpot. Check with mail-tester.com and Google Postmaster Tools.
2. Week 1: send normal mail from the inbox (real conversations) and start at 20–30 cold emails a day per inbox.
3. Week 2: 50 a day. Week 3: 80–100 a day. Use 2–3 inboxes on the sending domain to spread the load.
4. At 100 a day across three inboxes, the 2,500 enter the sequence over about 8–9 working days, so the whole run takes about 6 weeks end to end. Stagger: day 0 for each batch is the day that batch enters.
5. Send Tuesday to Thursday, 7–9am or 12–1pm local time (installers read email before they're on a roof and at lunch). Send by state so Perth gets its own time.
6. Watch daily: bounces under 3%, complaints under 0.1%, Gmail Postmaster reputation "Medium" or better. If anything slips, halve the volume for a week.
7. Images and links hurt cold deliverability. If placement is poor, send emails 1–4 as plain text from a person and keep the designed versions for people who have clicked.

## The Spam Act 2003 and business addresses that are published

Every commercial email to an Australian address needs three things: **consent**, **identification** and **an unsubscribe**.

**Consent can be inferred from a published address** when all of these are true (Spam Act, Schedule 2, clause 4):

1. The address is **conspicuously published** (e.g. on the business's own website, or a public business or industry directory where they put it there or agreed to it).
2. The publication **isn't accompanied by a statement** that the owner doesn't want unsolicited commercial email (e.g. "no marketing emails please" next to it). Check before you add the address.
3. The email is **relevant to the business, role, functions or duties** of the person or office the address belongs to. Software for running a solar business, sent to a solar retailer or installer, is relevant; sent to a personal address or a role with nothing to do with it, it may not be.

Keep where and when each address was published (the list's source column). If an address can't be traced to a conspicuous publication, leave it off.

**Never use a harvested list.** It's an offence to use, supply or acquire a list made by address-harvesting software, or the software itself (Spam Act, Part 3). Ask whoever supplied the 2,500 how it was built. If it came from a scraper or a bought "database", don't send to it.

**Identification**: every email names RENUABL, Reburthed Pty Ltd and ABN 96 662 374 905, with a way to contact us (hello@renuabl.com.au, and reply-to). Done in every footer.

**Unsubscribe**: a functional unsubscribe in every email, at no cost to the recipient, honoured within 5 working days, working for at least 30 days after sending. Done in every footer (`{{unsubscribe}}` → HubSpot's link).

Inferred consent covers this sequence; it isn't a licence to keep emailing forever. When the 8 are done, stop. Anyone who doesn't start a trial or reply drops out. A lawyer should look over this approach before the first send; the ACMA's guidance on the Spam Act is the plain-language reference.
