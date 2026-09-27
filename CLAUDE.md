@AGENTS.md

# RENUABL — working notes for Claude

## Read first

- `docs/product-contract/` is the UX contract (master prompt + four surface specs). When anything is ambiguous, prefer simplicity and those principles over adding features.
- `docs/BUSINESS_MODEL.md`: the household, not the lead or the job, is the core entity. Solar is product 1 of a catalogue.

## Product rules to preserve

- RENUABL recommends one system; the customer adjusts it. No catalogues.
- One matched installer by default; alternatives only behind a secondary link.
- The customer picks the install date; a refundable deposit comes before the 15-minute confirmation call (confirmation, not sales).
- Intelligence is branded "Ask RENUABL", never labelled "AI".
- Minimise jargon; technical detail lives behind disclosures.
- Installer portal is deliberately dark; green (`positive`) is reserved for confirmed / on-track / available / positive states.

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
