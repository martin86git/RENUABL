@AGENTS.md

# RENUABL — working notes for Claude

## Read first

- `docs/design/` holds the approved visual design (brand sheet, desktop + mobile customer screens, installer portal). **Match it.** It overrides any earlier styling in this repo.

- `docs/product-contract/` is the UX contract (master prompt + four surface specs). When anything is ambiguous, prefer simplicity and those principles over adding features.
- `docs/BUSINESS_MODEL.md`: the household, not the lead or the job, is the core entity. Solar is product 1 of a catalogue.

## Product rules to preserve

- RENUABL recommends one system; the customer adjusts it. No catalogues.
- One matched installer by default; alternatives only behind a secondary link.
- The customer picks the install date; a refundable deposit comes before the 15-minute confirmation call (confirmation, not sales).
- Intelligence is branded "Ask RENUABL", never labelled "AI".
- No traditional website navigation (no Home / Energy / Savings / … link bar). Customer screens show only the wordmark and account; people move through guided steps, the My RENUABL home cards and the mobile bottom tabs.
- The reservation deposit is $499 (`ASSUMPTIONS.deposit`).
- Checkout is an editable basket: optional items can be removed or added back; the core system is edited on the system step.
- RENUABL Care (`src/lib/domain/care.ts`, $19/month or $199/year) is opt-in only — never pre-selected, never charged with the deposit, billed after switch-on.
- The top package (Higher independence) includes 12 months of RENUABL Care free (valued at $199). After that it never auto-renews into a charge; continuing is the customer's choice.
- Desktop flow steps are centred columns (`FlowStep` `width`), not left-aligned.
- Post-purchase customers book service visits with their installer at `/my/service` (`src/lib/domain/service.ts`). Never quote a call-out fee in the UI: warranty work is free, other fees are confirmed before the visit is locked in.
- The confirmation call is booked by the customer via HubSpot Meetings (`NEXT_PUBLIC_HUBSPOT_MEETINGS_URL`, `src/lib/domain/booking.ts`).
- Minimise jargon; technical detail lives behind disclosures.
- Installer portal is deliberately dark; green (`positive`) is reserved for confirmed / on-track / available / positive states.

## Brand system (from `docs/design/brand-and-desktop.webp`)

- Colours: Background `#FAF9F6`, Sand `#F0ECE7`, Sage `#D9E7DC`, Forest `#1E3A2E`, Charcoal `#1A1A1A`, White. They live as tokens in `src/app/globals.css`; use `bg-canvas`, `bg-surface`, `bg-sage`, `text-forest`, `bg-primary`, etc.
- Type: Inter for UI (headlines large, regular weight, tight tracking), Source Serif for editorial lines ("Cleaner homes. Lower bills."), Caveat script for handwritten accents (`<Script>`).
- Voice: clear, reassuring, human, optimistic, modern, built for everyday people.
- Mascot and photography: `src/components/ui/brand-art.tsx`. Files in `public/brand/` are crops from the mockups (placeholders); replace them with the original renders and licensed photos under the same names, then clear `.next/cache/images` locally.
- Light artwork uses `.art-blend` (multiply + feathered edges) so it sits on the page colour without a box.

## Real businesses and claims

- Primero Electric & Solar is the installer of choice in Victoria. Only show figures that are real and attributed (its Google rating: 4.7 from 141 reviews, as supplied). Never invent ratings, review counts, install numbers or testimonials for a real business: `verifiedStats`/`reviewSource` on `Installer` gate what customers see.
- Brand proof points and testimonials in `src/lib/mock/brand.ts` are design placeholders and must be replaced with verified data before launch (Australian Consumer Law).

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
