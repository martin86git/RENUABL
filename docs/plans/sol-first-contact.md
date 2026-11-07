# Sol as the first point of contact

Draft plan, 8 Nov 2026 (Martin and Claude). Not built yet. To build after the deal chat lands.

## Why

"New lead received" should become "a conversation is underway" within minutes.

The automated introduction email with a project brief didn't work. It asked the customer to do work before giving them anything back. Someone who has just enquired wants to know three things: roughly what it costs, whether it's worth it, and whether their roof can take it.

## Principles

1. **Reward first, ask second.** Every message from Sol gives the customer something before it asks for anything.
2. **One easy ask at a time.** Every reply should take seconds: a tap, a photo, a word. Nobody should have to sit down and think about how to answer.
3. **Not scripted.** Only the first outreach is the same for everyone. After that Sol works from goals and rules, not templates:
   - he answers what they actually asked;
   - he reads what they need from how they wrote it (a worry about price, a partner to convince, a hurry, curiosity);
   - he picks the next easy ask that suits that person.
4. **Shopping, not a form.** The customer builds their system the way they'd put an outfit together online. They see how the parts work together, whether they complement each other, and what each one adds to the price. See below.
5. **Honest throughout.** Sol says he's the business's AI assistant and the team reads everything. Before a site visit every figure is "indicative". He never gives a firm price, discount, date, rebate approval or guaranteed saving.

## The shopping idea: "complete the look"

The first outreach links to a page for this deal, with no sign-in (like the proposal link). It shows the customer's own roof with a design already on it.

- **A base system** (the panels), drawn on their roof.
- **Parts that go with it**, each added or removed with one tap:
  - a battery (small, recommended, large);
  - blackout backup (only with a battery);
  - an EV charger.

  Each tap shows:
  - what it adds to the price;
  - what it changes for them, e.g. "your evenings run on the sun";
  - how it works with the rest, e.g. "the battery fills from your panels in the afternoon".

- **A running total** like a basket: the indicative price after rebates, the yearly saving and the payback, updating as they tap.
- **Only combinations that work.** This isn't a catalogue. A battery brings the hybrid inverter it needs, and backup only appears with a battery. It is still one recommended system with sensible choices around it, matching the rule that customers never browse catalogues.
- **"Talk to Sol" sits beside it**, like a stylist next to the fitting room. Questions go to the deal's conversation.

Every tap is a signal Sol reads, and that is how the conversation stays personal without the customer typing much. For example, if they add the battery, remove it, then add it back, Sol might say: "Not sure the battery's worth it? Here's what it'd mean for your bill." The team sees the taps too.

### The first easy reply

The roof comes from Google from the address alone, and it can be wrong: the neighbour's building, or an old photo. So the first ask is a single tap: **"Is this your home?"**

That tap checks the data, and it is the lowest-effort first reply possible.

### Sizing before a bill

Without a bill, the first design is sized from the roof and a typical home for the suburb, and the page says so. The next easy ask is "Send a photo of your bill and I'll size it to your home", using the bill reader we already have.

## How Sol replies (not a script)

For each customer message (a reply, a question or a tap), Sol is given:

- **Goal:** help them find a system they're happy with, then get them to the 15-minute call or a site visit.
- **What he knows:** the deal, the roof, the bill if there is one, the conversation so far, and their taps.
- **Rules:** see principle 5.
- **Hand-offs:** when he needs a person, he asks the team in the deal chat (for example "a design with the battery outside on the east wall") and tells the customer "I've asked the team to draw that for you".

Each reply aims to:

- answer every question they asked;
- address the need behind the question;
- end with one easy next step.

Replies are short, so they read like a text. Writing quality matters here, so these replies use the deep model (Opus), as the customer chat already does.

## What exists vs what is needed

| Piece                        | Today                                  | Needed                                            |
| ---------------------------- | -------------------------------------- | ------------------------------------------------- |
| Roof and an automatic design | Design it for me                       | Run on lead arrival, before anyone opens the deal |
| Bill from a photo            | `readBillWithClaude`                   | Reachable from the customer's page                |
| Customer conversation        | Proposal chat only, Sol off by default | A lead-stage page and chat, before any proposal   |
| The basket page              | Proposal options (Choose your system)  | Add-on taps, a running total, signals to Sol      |
| Sending                      | Outbox, hourly cron                    | First message within minutes of the lead          |
| Reading email replies        | None                                   | Later; the page link works first                  |
| Team visibility              | Deal chat (being built)                | Sol's notes, asks and the customer's taps there   |

## Order to build

1. **Lead-stage deal page.** Roof, "Is this your home?", the chat with Sol (reuse the proposal page's chat and `solAnswersCustomer` with lead-stage rules).
2. **First outreach on lead arrival.** Design it for me runs, then a short email with the link. The business switches it on (as with the sales agents).
3. **The basket.** Add-on taps with price and saving deltas from `costSystem` and `designFinance`, recorded as signals.
4. **Sol reads the signals.** Taps and messages go to Sol; he answers or asks the team in the deal chat.
5. **The bill photo upgrade.** Sending a bill resizes the system and updates the basket.
6. **Later:** reading email replies, SMS, and Sol calling (Vapi) when a customer asks for it.

## Decided (8 Nov 2026, Martin)

### Sol shows his reply, then sends it on a countdown

On the deal (the feed card and the deal chat), Sol shows "I'm going to reply with: …" and a countdown to when it sends.

- **Nobody approves it.** If nobody touches it, it sends when the countdown ends.
- **The team can:**
  - change the countdown (sooner or later);
  - pause it;
  - edit the words;
  - send it now.
- **The aim is for Sol simply to do the work.** The countdown is there for trust while the business gets used to him. The default gets shorter as it learns to trust him, and the business sets that default.
- **Reuse the sales agents' outbox** (`sol-agents.ts`: `sendAt`, Hold, Send now), with a much shorter wait for replies to a customer who has just written. Sol's agents use 30 minutes; a reply should be minutes.

### When Sol sends is the business's choice, nothing built in

Sol has no hours of his own. Each business sets them:

- **Always on (24/7)**, or
- **Its own business hours:** which days, and from and to each day.

These replace the two fixed choices the sales agents have today (`SEND_HOURS`: business or longer hours) and apply to everything Sol sends. The countdown on each message still applies inside those hours. Victorian public holidays could be a tick ("not on public holidays") rather than always off.

### Before a bill: what similar homes paid, then the bill makes it exact

The first message and page say, in effect:

1. "Here's what a system on your home could look like" (the design on their roof).
2. "We've estimated your bill at about $X–$Y a quarter" (a range, from a typical home of that size in the suburb).
3. "Here's what customers with similar systems paid us" (real prices from the business's own signed proposals).
4. "Send your bill and we'll make it exact" (the ask that brings accuracy).

**Why real prices beat a calculated price:** they're evidence, not a claim. They also show the business has done this before, which is social proof without reviews.

**How "similar" is chosen** (`domain/design/similar-prices.ts`, to build):

- Signed proposals of this business only.
- Same kind of system (solar only, or solar and battery), within about 1.5 kW and, with a battery, about 5 kWh of it.
- From the last 12 months.
- Shown as what those customers paid after rebates: the middle figure and the spread ("most paid $11,800 to $13,400").

**Rules:**

- **Never identify a customer.** No names, no streets, no exact dates. "Around Glen Waverley" at most, and only when several come from there.
- **A minimum number before showing**, e.g. 3 similar systems. With fewer, it falls back to the price of the design on their roof, labelled indicative.
- **Real figures only.** Exactly what was signed, and it says how "similar" was chosen and over what period, so it's true under Australian Consumer Law.
- **Rebates change over time.** Compare prices before rebates, then take off today's rebates for this home; otherwise a price from a year ago misleads.

### No marketing consent needed to reply to an enquiry

The customer asked to hear from us, so replying to their enquiry, and continuing that conversation, needs no separate marketing consent.

Newsletters or offers beyond the enquiry still need the marketing tick and an unsubscribe, as now.

## Open questions

- **A new business with no signed proposals** gets no "similar systems" line until it has some. Could RENUABL's own pooled prices across businesses stand in? Probably not: they aren't that business's prices, and pooling businesses' prices raises its own questions.
- **Which add-ons are on the shelf for each business:** only what is on its price lists.
- **Sizing without a bill:** whether a suburb-typical size is good enough, or whether it should be the smallest sensible system.
