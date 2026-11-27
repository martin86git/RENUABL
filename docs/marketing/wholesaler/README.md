# RENUABL Business: the wholesaler partner kit (draft for Martin's review)

A wholesaler is willing to mention RENUABL to its trade customers (solar retailers and installers) in a marketing email. This is what we hand them. Nothing here has been sent.

## The recommendation

**Lead with a booked demo, not a video.** A video can't play inside an email: every "video" in an email is a picture that links out. The button is **Book a demo** (27 Nov 2026, Martin: nobody opens a demo account themselves any more, "you either have to sign up, or book a demo in"): it opens the front page with a short form (name, business, work email, mobile, a time that suits), RENUABL's staff are emailed, and someone shows them round on a short video call. So the kit is:

1. **The email** (`email.html`): an animated picture of four real screens with example data (`hero.gif`), a short note in the wholesaler's voice, one button, **Book a demo**, then a line to the video and the price.
2. **A newsletter block** (`newsletter-block.html`): the same in a heading, one paragraph and the button, for a wholesaler that would rather drop us into its usual newsletter than send an email of its own.
3. **A 90-second Loom, recorded by you** (script below): the second link, for people who want to watch before they press. Recorded by the founder it reads as a person showing their work, which a polished film doesn't; it takes one take; and you can redo it as the product changes. `video-thumb.jpg` is ready for it (a frame with a play button).

The product film already on `/business` stays the page's hero; the email sends people to Book a demo first and to the front page second.

## What to give the wholesaler

- `email.html` (or `newsletter-block.html`), with **{Wholesaler}**, **{Loom link}** and their own footer filled in. Their email platform puts in `{firstName}` its own way (HubSpot, Mailchimp and Klaviyo each write it differently): tell them to swap it for theirs, or drop "Hi {firstName}," for "Hi there,".
- The plain-text copy below, for platforms that build the email themselves.
- The pictures. They load from `https://www.renuabl.com.au/design/partner/hero.gif`, `hero.jpg` and `video-thumb.jpg` **once this folder is deployed** (check each opens before they send). A wholesaler can also upload them to its own platform.

**It goes from their list, so the Spam Act is theirs**: their footer (who they are, why the reader gets it, unsubscribe) goes on, and only to people they may market to. We don't receive their list.

## Before they send

1. **Fill in the tracking.** `SLUG` in `build.mjs` (for example `rexel`), then run `node docs/marketing/wholesaler/build.mjs`. Every link carries `utm_source=<slug>&utm_medium=email&utm_campaign=wholesaler-launch`. A demo booked from these links keeps its source and campaign: the lead's note and the staff email say "Came from: <slug> · wholesaler-launch" (`cleanDemoRequest` in `domain/design/sales-leads.ts`).
2. **Record the Loom** and put its link in `LOOM` in `build.mjs` (or take the video line out).
3. **Expect a wave of demo bookings.** Each is a lead under Enquiries on RENUABL admin and in /admin's pipeline, where the time is booked and reminders go out. Someone has to ring or email each within a business day, as the form promises.
4. **`/business` is still hidden** (`BUSINESS_LINK_SHOWN` false: noindex, out of search). The links still open for anyone given them, so the email works either way; decide whether launch day is the same day.
5. **Test it** in their platform's preview on Outlook for Windows (it shows the GIF's first frame, which stands on its own), Gmail and Apple Mail.

## The email, as plain text

**Subject:** Solar just got a brain
**Or:** Software for solar businesses, with AI built in
**Preview:** Design, CRM, proposals and service in one platform. Book a demo and see it at work.

**Solar just got a brain.**

Hi {firstName},

We've been talking with RENUABL, an Australian team building software for solar retailers and installers, and we think it's worth a look.

RENUABL Business puts the whole job in one place. Draw a roof and it's priced as you draw. Send a proposal under your own brand that your customer accepts online. Once it's signed, the order, the install calendar and the installer's job card follow on.

Built into it is Sol, an AI that works inside your deals. He lines up who to call next, drafts the follow-up and answers questions on solar and the standards, with his sources. He never sends anything without you.

Book a demo and someone from RENUABL will show you round on a short video call, with example customers and deals.

**[Book a demo]** → https://www.renuabl.com.au/?demo=1

Rather watch first? Here's a 90-second walkthrough: {Loom link}

$99 a user a month, and the first month is $29 a user. Prices include GST. Cancel any time. More: https://www.renuabl.com.au/business

RENUABL Business is made by Reburthed Pty Ltd trading as RENUABL, ABN 96 662 374 905.

### The newsletter block

**Solar just got a brain**
RENUABL Business is software for solar retailers and installers: roof design that prices as you draw, branded proposals customers accept online, and everything after the sale in one place. Sol, its built-in AI, lines up your day and drafts your follow-ups. Book a demo and someone from RENUABL will show you round.
**[Book a demo]**

### Claims checked

- No best, first, leading or guaranteed; no other product named or compared.
- "An Australian team": RENUABL is Reburthed Pty Ltd. Change it to "a Melbourne team" only if that's right.
- Price as on `/business`, never shown as a discount. The wholesaler may prefer to leave the price out: the line can go without changing anything else.
- "Someone from RENUABL will show you round": a person has to follow up every booking; the form says within a business day.
- Every screen in `hero.gif` is a real RENUABL screen with made-up example data. They were taken before the latest look; retake them with `node tools/demo/shoot.mjs` and run the build again if you want today's.

## The Loom: 90 seconds, one take

Record in the demo account (RENUABL admin's Demo account, or the local "Sunrise Solar (example)"), browser full screen, your face in the corner. Talk to one installer, not a crowd.

| Time    | On screen                                         | Say (in your own words)                                                                                                                                   |
| ------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–10 s  | Today, Sol's greeting                             | "I'm Martin from RENUABL. This is what a solar business's day looks like when the software does the sorting. Ninety seconds."                             |
| 10–25 s | Today: Up first, Before you call                  | "Sol has lined up the day, most pressing first. Before I ring Olivia, he's told me where things stand: she wants a battery, her roof isn't designed yet." |
| 25–50 s | Design it for me on her roof, the quote building  | "One press and the roof is designed three ways, priced as it goes. Payback, best return, most independence."                                              |
| 50–65 s | The proposal, Send to customer                    | "The proposal goes out under your own brand. She can accept it online, and chat to you on the same page."                                                 |
| 65–80 s | Signed proposals, Ordering station, Installations | "Once she signs, the order, the install calendar and the installer's job card follow on. Nothing typed twice."                                            |
| 80–90 s | The front page, Book a demo                       | "Don't take my word for it. Press Book a demo and I'll show you round your own kind of jobs on a short call."                                             |

Keep it to what the product does today: don't mention the Marketplace, calling or texting (RENUABL's own only for now), or anything marked coming soon.
