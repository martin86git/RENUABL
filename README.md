# RENUABL

The consumer distribution layer for home energy: a premium, guided way for households to get solar, batteries and EV charging, plus the installer portal that fulfils it.

See [`docs/BUSINESS_MODEL.md`](docs/BUSINESS_MODEL.md) for the model, [`docs/product-contract/`](docs/product-contract) for the UX contract, and [`docs/design/`](docs/design) for the approved visual design this build matches.

## Surfaces

| Surface                      | Routes                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Consumer (mobile + desktop)  | `/` → `/start/analysing` → `/start/profile` → `/start/system` → `/start/extras` → `/start/installer` → `/start/date` → `/start/reserve` → `/start/confirmed` |
| My RENUABL (post-install)    | `/my`, `/my/energy`, `/my/savings`, `/my/health`, `/my/upgrades`, `/my/support`, `/my/profile`                                                               |
| Installer portal (desktop)   | `/installer` dashboard, `/installer/jobs`, `/installer/jobs/[id]` site pack, `/installer/schedule`, `/installer/performance`, …                              |
| Installer field app (mobile) | Same routes; mobile renders Today / Jobs / Messages / More with the sequential status flow on each job                                                       |

## Launch market

Victoria first. Market defaults (state, fallback postcode, Melbourne time zone and "today" for installer schedules) live in `src/lib/domain/market.ts`; sample installers, addresses and jobs are Victorian.

## Installer of choice

Primero Electric & Solar (Malvern East) is the default matched installer across Victoria. Its public Google rating (4.7, 141 reviews) is shown with attribution; other performance figures are placeholders and hidden from customers. The remaining installers are fictional alternatives for development.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 with shared design tokens in `src/app/globals.css` (light consumer theme, `.theme-installer` dark theme)
- Radix UI primitives (`radix-ui`) for accessible dialogs, tabs, accordions, radios and switches
- Vitest for domain logic tests

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Useful scripts:

```bash
npm run typecheck  # next typegen + tsc
npm run lint
npm test           # vitest (domain logic)
npm run format     # prettier
npm run build
```

## Deploying

Hosted on Vercel (Sydney region, the closest to the Victorian launch market). See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the one-time setup. Every deployment shows a "sample data" banner and is hidden from search engines until `NEXT_PUBLIC_PREVIEW_MODE=false`.

## Project layout

```
src/
  app/
    (consumer)/        home, guided flow (/start/*), My RENUABL (/my/*)
    installer/         installer portal + field app
  components/
    ui/                design-system primitives (buttons, cards, controls, calendar, mascot)
    consumer/          consumer shells, flow state, Ask RENUABL
    installer/         portal shell, job workspace, schedule board
  lib/
    domain/            pure business logic: sizing, pricing, matching, scheduling, job status
    services/          the API seam — UI only talks to these
    mock/              typed mock data behind the services
```

Everything under `src/lib/mock` is placeholder data. Swap a service's implementation for a real API call; the screens don't change.

## Not yet real

- Payments (Apple Pay / Google Pay / card) are mocked in `services/consumer.ts`; wire up a payment provider's hosted fields before launch.
- Address autocomplete uses a sample list; replace it with a geocoding provider.
- Brand artwork in `public/brand/` is cropped from the design mockups — swap in the original mascot renders and licensed photography.
- Brand proof points ("50,000+ homes", "4.9 from 6,000+ reviews") and testimonials in `src/lib/mock/brand.ts` are design placeholders — replace with verified figures.
- "Ask RENUABL" uses reviewed canned answers (`services/ask.ts`); the function signature is ready to be backed by a model.
- Pricing and rebate figures in `domain/recommendation.ts` are placeholder assumptions and must be validated before showing to customers.
