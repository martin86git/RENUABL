@AGENTS.md

# RENUABL — working notes for Claude

## Read first

- `docs/design/` holds the approved visual design (brand sheet, desktop + mobile customer screens, installer portal). **Match it.** It overrides any earlier styling in this repo.

- `docs/product-contract/` is the UX contract (master prompt + four surface specs). When anything is ambiguous, prefer simplicity and those principles over adding features.
- `docs/BUSINESS_MODEL.md`: the household, not the lead or the job, is the core entity. Solar is product 1 of a catalogue.

## Product rules to preserve

- RENUABL recommends one system, sized from the customer's electricity bill. No catalogues.
- The customer uploads their latest bill on "About your home"; Claude reads it server-side (`src/app/api/bill/route.ts`, `src/lib/server/bill-reader.ts`) and `src/lib/domain/bill.ts` validates the figures. Ask only for usage and prices, never personal details, and don't store the file.
- Solar is sized to what the home uses, never below the 5 kW minimum system (`ASSUMPTIONS.minSystemKw`). When there is a battery, now or planned ("Thinking about adding a battery later?"), solar gets `ASSUMPTIONS.batteryReadySolar` headroom to charge it. Customers never choose panel counts or battery sizes; the options differ in battery (none / sized to evening use / one size up).
- The battery question is "Would you like a battery?" (a sale now, not "later"). Yes leads with Recommended, No with Essential.
- Existing solar (the bill shows exports): ask its size, or "I'm not sure", then "Replace or expand?". Expanding (or a known size) keeps the panels and sells a battery in every option, with extra panels only if exports can't fill it, and always shows `EXPAND_DISCLAIMER` (the inverter is unknown until the call), with an optional upload of the inverter's front and its model/serial sticker, which Claude reads (`/api/inverter`) for make, model and kW; photos aren't stored. Replacing sizes a new system to estimated real use (`realAnnualUse`, placeholder self-use share) and says it's an estimate. Logic: `src/lib/domain/existing-solar.ts`.
- One matched installer by default; alternatives only behind a secondary link.
- The customer picks the install day only; installers arrive 7am–9am (`INSTALL_ARRIVAL`), never a customer-chosen time. The 15-minute confirmation call (confirmation, not sales) comes before the deposit.
- Intelligence is branded "Ask RENUABL", never labelled "AI".
- No traditional website navigation (no Home / Energy / Savings / … link bar). Customer screens show only the wordmark and account; people move through guided steps, the My RENUABL home cards and the mobile bottom tabs.
- Reserving is free: the reserve step collects name, mobile and email (no payment) and sends the lead to HubSpot (`/api/reserve`, `HUBSPOT_PRIVATE_APP_TOKEN`). The customer is emailed the order breakdown and next steps (`src/lib/domain/emails.ts`, sent via Resend in `src/lib/server/email.ts`, `RESEND_API_KEY`/`EMAIL_FROM`) with an install-day invite; a call booked in the in-app calendar is noted in HubSpot and emailed with its own invite (`/api/call`). The confirmation page offers add-to-calendar (.ics + Google, `src/lib/domain/calendar.ts`) and only says an email was sent when it was. Emails never block a reservation. The $499 refundable deposit (`ASSUMPTIONS.deposit`) is taken after the confirmation call via Stripe.
- Pricing is costed, not estimated: `src/lib/domain/catalogue.ts` holds the chosen products at supplier cost (AWM Clayton price list: Jinko 475 W panel, Sungrow string inverters for solar-only, Sigenergy SigenStor controller + 8 kWh modules for batteries, Antai rail and tin/tile kits). `src/lib/domain/costing.ts` builds the bill of materials by rule: inverter = smallest with array ≤ 133% of its rating; rail = (panel width + 0.1 m) × 2 per portrait panel in 4.8 m lengths; one tin/tile kit per 2 kW (roof "not sure" → tile); flat roofs get an Antai 10–15° tilt kit per 2 kW instead plus $15/panel tilt installation; BOS = DC label kit, battery label kit (when there's a battery), 10 MC4 pairs, 4 panel clips per panel in packs of 100, and an AC isolator sized to the inverter (`acIsolatorFor`): NHP 40 A 2-pole single phase / 3-pole three phase while the inverter's output is ≤ 32 A a phase, a 63 A for bigger single-phase inverters (8 kW and up; the 63 A is a stand-in 3-pole until a 63 A 2-pole is on the price list); solar install 30c/W (+$400 double storey); battery install $1,800 per stack with modules beyond six at $1,800 ÷ 6 each; EV charger install $1,000; +$150 only when a three-phase inverter is fitted. Install costs are ex GST. Then +20% margin, +GST. "About your home" asks roof, storeys and phase (phase "not sure" → single). Items marked PLACEHOLDER (heat-pump supply choice and install, other add-ons) must be confirmed. Heat pumps will need their own rebates (federal STCs, Victorian VEECs, Solar Victoria hot water rebate) before they're sold.
- Rebates (`src/lib/domain/rebates.ts`) are separate customer-facing lines: federal solar STCs, federal battery STCs, and Solar Victoria (VIC addresses only, behind a customer toggle, with an eligibility link). The Solar Victoria interest-free loan is a second, always-visible toggle (switching it on switches on the rebate it depends on) that lowers the upfront cost, not the price. For expansions of existing solar the card explains that Solar Victoria doesn't apply rather than disappearing. Rules are loaded daily from the CER and Solar Victoria (`/api/rebates`, `src/lib/server/rebate-rates.ts`, parsers tested against saved page text in `src/lib/domain/__fixtures__`), falling back to `VERIFIED_RATES` (hand-checked 27 Sep 2026) per item. STCs use the CER postcode zone table (`zone-ratings.ts`), deeming years for the install year, and the battery factor for the install date, tapered 100% ≤14 kWh / 60% ≤28 / 15% ≤50 kWh. The STC $ price isn't published by the CER: set `STC_PRICE`. Sunshine comes from NASA POWER for the home's coordinates (`/api/sunshine`).
- Checkout is an editable basket: optional items can be removed or added back; the core system is edited on the system step.
- RENUABL Care (`src/lib/domain/care.ts`) is switched off (`CARE_ENABLED = false`) until performance summaries and alerts can be delivered (phase 2/3, via inverter monitoring APIs). Don't show or sell it. When it returns: $19/month or $199/year, opt-in only, never pre-selected, never charged with the deposit, billed after switch-on.
- System options, in order: Essential · Recommended (default) · Maximum. (While Care is off, Maximum does not include free Care.)
- Desktop flow steps are centred columns (`FlowStep` `width`), not left-aligned.
- My RENUABL (the post-install home) is shown before purchase as a preview: `PortalTeaser`/`PortalPreview` (`src/components/consumer/portal-preview.tsx`) on the system step and confirmation page, and a banner on `/my` for reserved-but-not-installed customers. Always label its figures as an example home; its live data depends on inverter monitoring integration.
- Post-purchase customers book service visits with their installer at `/my/service` (`src/lib/domain/service.ts`). Never quote a call-out fee in the UI: warranty work is free, other fees are confirmed before the visit is locked in.
- The customer books the confirmation call themselves: HubSpot Meetings when `NEXT_PUBLIC_HUBSPOT_MEETINGS_URL` is set, otherwise the in-app calendar (weekday times before the install date, `src/lib/domain/booking.ts`).
- Minimise jargon; technical detail lives behind disclosures.
- Installer portal is deliberately dark; green (`positive`) is reserved for confirmed / on-track / available / positive states.

## Brand system (from `docs/design/brand-and-desktop.webp`)

- Colours: Background `#FAF9F6`, Sand `#F0ECE7`, Sage `#D9E7DC`, Forest `#1E3A2E`, Charcoal `#1A1A1A`, White. They live as tokens in `src/app/globals.css`; use `bg-canvas`, `bg-surface`, `bg-sage`, `text-forest`, `bg-primary`, etc.
- Type: Inter for UI (headlines large, regular weight, tight tracking), Source Serif for editorial lines ("Cleaner homes. Lower bills."), Caveat script for handwritten accents (`<Script>`).
- Voice: clear, reassuring, human, optimistic, modern, built for everyday people.
- Mascot and photography: `src/components/ui/brand-art.tsx`. "About your home" uses the battery mascot (`pose="battery"`, image B) with a slow bounce (`bounce`, 3.6s; keep it slow so it doesn't distract from the questions). Files in `public/brand/` are crops from the mockups (placeholders); replace them with the original renders and licensed photos under the same names, then clear `.next/cache/images` locally.
- Light artwork uses `.art-blend` (multiply + feathered edges) so it sits on the page colour without a box Multiply needs a backdrop in the same layer: if its container is `sticky`, `fixed` or otherwise isolated, give the container `bg-canvas` or a white box appears.

## Real businesses and claims

- "How we worked this out" (`src/lib/domain/sources.ts`, on the system step) names only sources actually used for that home (bill, Google Maps, NASA POWER, Clean Energy Regulator, Solar Victoria, supplier prices). Say "based on"/"estimate"; never "exact", "precise" or "guaranteed" (tested). Text only, no third-party logos.

- Primero Electric & Solar is the installer of choice in Victoria. Only show figures that are real and attributed (its Google rating: 4.7 from 141 reviews, as supplied). Never invent ratings, review counts, install numbers or testimonials for a real business: `verifiedStats`/`reviewSource` on `Installer` gate what customers see.
- RENUABL has no customer reviews yet: don't show ratings, review counts, "homes powered" or testimonials for RENUABL until there are real, verifiable figures (Australian Consumer Law).

## Launch market

- Victoria first. Use `LAUNCH_MARKET`, `todayInMarket()` and `marketDateTime()` from `src/lib/domain/market.ts` instead of hard-coding a state, postcode, time zone or the server's local date (Vercel runs in UTC).

## Architecture rules

- Business logic lives in `src/lib/domain` (pure TS, unit tested). Don't put it in components.
- UI reads and writes only through `src/lib/services/*`; mock data stays in `src/lib/mock`.
- Use the semantic color tokens (`bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `text-positive`, …) rather than raw colors so both themes work.
- Mobile-first, but build deliberate desktop layouts (see `FlowStep`, `InstallerShell`) rather than stretching mobile.
- Don't put `position: fixed` elements inside an animated (`transform`) ancestor, because it breaks fixed positioning. `FlowStep` renders its sticky CTA outside the animated section for this reason.
- Server pages that depend on "today" call `await connection()` so they render per request.

## Checks before committing

```bash
npm run typecheck && npm run lint && npm test && npm run format:check && npm run build
```
