# RENUABL for solar businesses: the funnel

From first hearing of RENUABL to the whole team working in it. The line through every stage: **Pay less. Do more.** A better product for less than old-school solar software, with no fee per signature.

Pricing as agreed on 1 November 2026, all including GST: **$29 a user a month**; yearly is 20% off the whole package; the design tool is **$3 a job** in token packs; a **14-day free trial with 5 design jobs**, card taken on Stripe's page at sign-up; **Enterprise (13+ users)** talks to sales. Coming soon, always labelled so: HubSpot, Pipedrive and Nearmap integrations, automatic proposals from Nearmap. The marketplace is register-your-interest.

## Show Sol doing solar work

Martin, 1 Nov 2026: use real, industry-specific answers from Sol in the marketing, not generic "AI assistant" lines. The first is Sol in the Installations channel, asked where a battery can go on a garage wall with a door and a window: the clearances (AS/NZS 5139), drawn, a bollard if a car could hit it, and what to check on site. Retake it with `node tools/demo/shoot.mjs 3100 sol-garage-wall` after asking him again in the demo business (`public/design/landing/sol-garage-wall.webp` / `.jpg`; on the sign-up page under Sol, `SOL.example`, and in cold email 4). Keep collecting more: a stringing question, a pre-approval question, a quote follow-up. Rules for each:

- A real answer from the product, shown as it came, with Sol's own "check it" wording left in.
- Nothing of a real customer in it (team channels and example data only).
- Technical figures checked against the source before use (these are marked VERIFY: AS/NZS 5139 clearances).
- Never claim Sol is always right or replaces the standard, the maker's manual or the regulator.

## The stages

| Stage                                 | What they need to believe                            | Message                                                                                                                                                  | Channel                                                                                                                                                 | Metric                                                                             | Gap to close                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Discover**                       | "There's something better than what I'm paying for." | Old software. Old prices. Pay less. Do more.                                                                                                             | The cold sequence (`edm/`), Meta and LinkedIn ads to owners and sales managers, solar Facebook groups, word of mouth from installers who get a job card | Reach; email click rate; cost per landing-page visit                               | No referral offer yet. No case study or real customer figures (we can't claim any until we have them). No LinkedIn ads set up.                                                                                                                                                                                                                                                                                                            |
| **2. Land on the page**               | "This is fast and it's for a business like mine."    | "From roof to revenue." The live designer demo, then three designs, send it from the driveway, signed then it runs itself. Price beside the old way.     | `renuabl.com.au/design` (being rebuilt by another session), arriving with `utm_source`                                                                  | Visit → trial start rate; scroll to the demo                                       | The page and the emails must say the same price and trial terms. A pricing section with the comparison (as in email 2) and an FAQ on the card at sign-up. Meta/HubSpot tags aren't on `/design` (it's noindex with no ad tags): ad conversions won't be measured until that's decided.                                                                                                                                                    |
| **3. Start the trial**                | "It's safe to try: nothing charged for 14 days."     | 14 days free, with 5 design jobs on us. Card on Stripe's secure page, nothing charged until the trial ends, cancel any time before then and pay nothing. | Sign-up on `/design` → Stripe checkout (being wired by another session)                                                                                 | Trials started; card-page drop-off                                                 | Asking for a card up front loses people at the Stripe page (the competitor asks for none). Watch the drop-off and test card-later if it's high. Trial sign-ups need to reach HubSpot so the cold sequence stops for them.                                                                                                                                                                                                                 |
| **4. Activated: first proposal sent** | "I did a real job in it, faster than before."        | Draw one real roof. Design it for me. Publish. Send it with a message.                                                                                   | In-product (the design tool home, Today's Next up), trial emails days 1–7, a 15-minute onboarding call offered                                          | Share of trials that send a first proposal within 7 days; time to first proposal   | **No customer or deal import yet**: they start from zero, so the first job has to be a new one. **No price list onboarding help**: the quote marks missing costs at $0 until a supplier list is uploaded, so the first proposal can't publish without one. Branding setup (logo, colours) before the first proposal. A sample price list to try with?                                                                                     |
| **5. Paid**                           | "It's worth more than $29 a head."                   | You sent N proposals and M were opened. Keep going, or go yearly and save 20%.                                                                           | Trial emails days 12–13, the account's billing page, Stripe                                                                                             | Trial → paid conversion; yearly share                                              | **The Billing settings page said "no plan, no charge" before the Stripe work**: it needs the plan, the trial end date and the card. Token packs for design jobs: where to buy more, and what happens at 0. Failed card handling (Stripe dunning emails).                                                                                                                                                                                  |
| **6. Whole team moved across**        | "Everyone works here now; the old system can go."    | Bring the whole team: sales, designers, office, installers. Permissions per person.                                                                      | Owner nudges in product, an email after the first signed proposal, sales call for 13+                                                                   | Seats per paying business; share of businesses on 3+ seats; old-tool cancellations | **Adding a member sends them no email** (the owner adds an address and has to tell them). **Seats are added in Stripe's portal**, not in Users and permissions: the two must agree, and a member added in RENUABL should add a seat (or say what it will cost). No import of past deals from the old CRM. HubSpot and Pipedrive sync are still coming soon. Gmail inbox only works for Google test accounts until Google reviews RENUABL. |

## Trial emails (Marketing Hub: these people signed up, so they've opted in)

Sent from a person, plain and short, one action each. Each stops being sent when the thing it asks for is done.

**Day 1: Do one real roof.**
Subject: "Your first roof takes about as long as a coffee." (Only if timed on real roofs first; otherwise "Your first roof, start to finish.")
Pick a job you're quoting this week. Type the address, trace the roof or use Google's, press Design it for me. Upload your supplier price list first so the quote prices properly (Settings → Pricing). Button: Open the design tool.
Skip if: they've already saved a design.

**Day 3: Make it yours, then send it.**
Subject: "Put your logo on it."
Logo, colours, warranty words and your terms in Settings → Proposals. Then publish the roof you drew and send it with a message. The customer reads, chats and signs on their phone. Button: Set up your proposals.
Skip if: they've already published a proposal.

**Day 7: Let Sol do the chasing.**
Subject: "Ask Sol who's gone quiet."
Halfway through the trial. Ask Sol who needs a follow-up, have him draft it, send it yourself from the deal. Then show them email opens and the deal heat. Offer a 15-minute call to set up their price lists and fields. Button: Open Today.
Skip if: none. Everyone gets this one.

**Day 12: Two days left. Here's what you did.**
Subject: "Your trial ends on <date>."
Their own numbers: designs made, proposals sent, opened, signed (from their account; leave out any that are zero rather than showing a zero). What happens on day 15: $29 a user a month, GST included, charged to the card on file; yearly saves 20%; cancel any time before <date> and pay nothing. Button: Choose monthly or yearly.

**Day 13: Bring the team before it starts.**
Subject: "Add your team while it's free."
Add the people who quote, design and run installs now, while the trial covers them. Permissions per person, a Designer role, installers on the job card with no login. 13 or more? Reply and we'll talk enterprise. Button: Add your team.

After paying: one email after their first signed proposal ("That one ran itself: here's where the order is"), and one at day 30 asking what's still in the old system and offering to help move it.

## What to measure, end to end

1. Cold email: delivered → clicked → trial started (per 1,000 delivered).
2. Landing page: visits → trial started.
3. Trial: started → first proposal sent within 7 days (**activation**) → paid at day 15.
4. Paid: seats in month 1 → seats in month 3; yearly share; design job packs bought.

Until the trial sign-up reaches HubSpot with its `utm_source`, steps 1–3 can't be joined up. That's the first gap to close.
