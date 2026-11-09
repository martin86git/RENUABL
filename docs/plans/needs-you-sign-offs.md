# Needs you: sign-offs, not tasks

Draft plan, 9 Nov 2026 (Martin and Claude). Not built yet.

## Why

On Today's deal feed every card stays, and nothing feels finished. But the deal isn't what gets done: the deal is still live. What gets done is **the thing it needs from you right now**.

Following `docs/product-contract/LIVE_SOFTWARE.md`, Sol does the work and a person signs off where their judgement or their name is needed. So:

- **All activity** stays the full feed and keeps updating.
- **Needs you** becomes a short list of **sign-offs**: decisions only a person can make, each with the work already done by Sol, and one press to approve it.
- A sign-off **clears itself** when the decision is made, wherever it is made. **Done** and **Later** cover the rest.
- Clearing the list should feel like progress: a count going down, an "All clear" at zero, and how many were cleared today.

## What a person still has to do

| Today's next move  | Who can do it                                                                     | Becomes                                       |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------- |
| Reply to <name>    | Sol, within his rules. He hands over prices, discounts, dates and promises.       | **Answer what Sol handed over** (only those)  |
| Review Sol's email | Sol sends it himself once his agent is on.                                        | A countdown chip, not a sign-off              |
| Design the roof    | Sol drafts three designs. A person checks them and decides the costs on each job. | **Check Sol's design**                        |
| Send the proposal  | A person: it commits a price to the customer.                                     | **Approve the price and send**                |
| Call <name>        | Sol, where calls are on (RENUABL's own deals today). A person elsewhere.          | Sol's call on a countdown; else stays a task  |
| Book the install   | A person: it needs a real day and an installer.                                   | **Commit the install day** (Sol suggests one) |
| (new)              | A person: Sol can't see money arrive in a bank account.                           | **Confirm the deposit came in**               |

## The five sign-offs

Each sign-off shows what Sol has ready, what he based it on, and one lit button. Pressing it does the act. It doesn't just tick a box.

### 1. Answer what Sol handed over

- **When:** Sol wrote `SOL_HANDED_OVER` on the deal (a price, discount, date or promise question), or the customer is waiting and Sol isn't answering for this business.
- **Sol has ready:** their question in their words, and a draft reply (`solDraftsReply`), marked as a draft.
- **Approve:** sends the reply into their chat (and the email, when replies are emailed).
- **Clears by itself:** any reply from the team.

### 2. Check Sol's design

- **When:** a lead with a place on the map and no checked design.
- **Sol has ready:** three designs on the roof (Design it for me), the strings, and the Ready to install light.
- **Approve:** opens the designer pop-up on the primary design with **Looks right** in its rail. Pressing it marks the design checked: who and when, on the roof's design (new `checkedBy`/`checkedAt`). Changing anything and saving counts too.
- **Clears by itself:** the design is marked checked.
- **Needs first:** Sol designing before anyone opens the roof. Today Design it for me runs only when someone opens it in the browser. Running it on the server when a lead arrives is shared with `sol-first-contact.md` step 2. Until then this sign-off stays **Design the roof**.

### 3. Approve the price and send

- **When:** the design is checked and no proposal has gone out.
- **Sol has ready:**
  - the priced proposal: indicative for a lead, final after the site visit;
  - the costs still to decide on each job (`undecidedCosts`), with his suggestion and why. For example: "Switchboard upgrade: include. The photo shows old fuses."
  - the message to send with it (`SEND_TEMPLATES`, filled in).
- **Approve:** the person ticks each undecided cost in the card (Include or Leave out), then one press publishes and sends the message. It needs the `publish` permission, and `prices` to change a cost.
- **Clears by itself:** a proposal is published and sent from anywhere.

### 4. Commit the install day

- **When:** sold, both approvals through (`gateOf` is "book"), and no install date.
- **Sol has ready:** the first working day in a week with room (`capacityWeeks`, the business's weekly capacity), after any rebate lead time, with the installer it usually goes to.
- **Approve:** sets the date. The customer reminder and the job card follow as now.
- **Clears by itself:** an install date is set anywhere.
- An approval still waiting isn't a sign-off: that's Sol's to chase (later, with the procurement agent).

### 5. Confirm the deposit came in

- **When:** the customer says they paid (`deposit_said_at`) and it isn't marked received.
- **Sol has ready:** the amount, the reference and when they said it.
- **Approve:** marks it received (`markDeposit`). Not received puts it back as due.
- **Clears by itself:** marked either way, or paid by card through Stripe.

## Done and Later

For anything handled outside the app: you rang from your own phone, a colleague sorted it, it's no longer relevant.

- **Done:** takes the card out of Needs you. It's written on the deal's record ("Marked done by Martin: Call Alex").
- **Later:** takes it out until **Tomorrow 9am**, **Next week** or **Until they reply**.
- **A new event always brings it back:** the customer writes, opens the proposal, or Sol needs something. Clearing a card can never bury a deal.
- **No separate Dismiss.** It would mean the same as Done without a record, and that's how deals get lost.

How it's kept: a new table, `design_feed_marks` (business id first): the deal, the sign-off's kind, `done` or `later`, `until`, who and when. A mark holds while the deal's `lastAt` is no newer than the mark and `until` hasn't passed. Shared by the team, so the same card doesn't sit in everyone's list.

## Routed to the person whose job it is

Needs you shows **Mine** by default, with **Everyone's** beside it (the feed already has the switch):

- **Check Sol's design:** designers, else the deal's owner.
- **Approve the price:** those with `publish`. Cost decisions need `prices`.
- **Handed over:** the deal's owner, else everyone who sees the deal.
- **Install day and deposit:** those with `publish`.

This is the same rule as the deal chat's `askFollowers`, so it can be shared.

## It should feel like work getting done

- **Needs you N counts down** as cards clear. A cleared card slides out with a small tick (still with reduced motion).
- **At zero:** "All clear. 7 done today." with Sol's mark, and what Sol did in that time ("Sol sent 4 emails and drafted 2 designs").
- **Done today** counts every sign-off made today: automatic clears (a design checked, a proposal sent, a reply sent, a day set, a deposit confirmed) and Done presses, read from the deal records and the marks in the market's day.
- **Your day** and Sol's day line use the same count.

## Order to build

1. **Done, Later and the count.** Marks table, Done and Later on each card, the record line, Needs you counting down, All clear with today's count. It works with today's next moves, so it can ship first.
2. **Sign-offs where the data already exists:**
   - Answer what Sol handed over (`SOL_HANDED_OVER`, `solDraftsReply`);
   - Confirm the deposit (`deposit_said_at`, `markDeposit`);
   - Commit the install day (`gateOf`, `capacityWeeks`);
   - Review leaves Needs you while an agent is on (it's a countdown chip instead).
3. **Approve the price and send.** Undecided costs with Sol's suggestions in the card, then publish and send in one press.
4. **Check Sol's design.** Design it for me on the server when a lead arrives (shared with `sol-first-contact.md`), then **Looks right** and the checked mark.
5. **Routing by role.** Mine and Everyone's by the rules above.

## Open questions

- **Design jobs cost money.** A roof is charged ($3, $7 with a battery) the first time it's saved. If Sol designs every lead on arrival, every lead is charged, including ones that go nowhere. Charge when a person checks it instead? Only design leads with a phone or email? Or let the business switch it on?
- **Approve and send in one press.** It commits a price to a customer, which `LIVE_SOFTWARE.md` says needs permission, and the press is that permission. Should a large job (over a set price) need the owner's approval too?
- **Done for the team or for one person.** Shared is planned, so a card cleared by one person isn't left in a colleague's list. A team that splits work by person might want it per person.
- **Later's choices.** Tomorrow 9am, Next week and Until they reply. Is a picked date worth adding?
