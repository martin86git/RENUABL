# RENUABL business model

## Thesis

RENUABL is the **consumer distribution layer for home energy**.

- Lead generation is version 1 of monetisation.
- Solar is product 1.
- Installation is fulfilment.
- **The real asset is that RENUABL owns the relationship with the electrified household.**

## Household lifetime value loop

```
Meta (paid social)
  ↓ consumer acquisition
  ↓ home analysis
  ↓ system transaction
  ↓ installer marketplace
  ↓ installation
  ↓ monitoring
  ↓ household energy data
  ↓ intelligent recommendations
  ↓ upgrades
  ↓ more hardware
  ↓ more data
  → higher customer LTV
```

## Marketplace flywheel

```
more customers → more installer jobs → more installers → better availability
      ↑                                                        ↓
better customer experience  ←  better pricing  ←───────────────┘
```

## How the codebase maps to the model

| Loop stage                 | Where it lives                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisition + attribution  | `src/components/consumer/flow-state.tsx` records `utm_source` / `utm_campaign` on first visit, so channel → household LTV can be measured.                    |
| Home analysis              | `src/app/(consumer)/start/profile`, sizing in `src/lib/domain/recommendation.ts`                                                                              |
| System transaction         | `start/system`, `start/reserve` (refundable deposit), pricing in `recommendation.ts`                                                                          |
| Installer marketplace      | `src/lib/domain/matching.ts` (one default match; alternatives secondary)                                                                                      |
| Installation / fulfilment  | Installer portal `src/app/installer/*`, field status flow in `src/lib/domain/job-status.ts`                                                                   |
| Monitoring + data          | `src/app/(consumer)/my/*`, `src/lib/services/home.ts`                                                                                                         |
| Recommendations → upgrades | `my/insights`, `my/upgrade` — insights lead into upgrade offers                                                                                               |
| Supply-side flywheel       | Matching weights installer rating, on-time, first-time pass and capacity; the installer Performance page shows exactly these so installers optimise for them. |

## Design principles that follow

1. **The household is the primary entity**, not the lead or the job. A household can own many products and many jobs over time.
2. **Products are a catalogue.** Solar, battery and EV charger are the first entries; heat pumps and others follow without reshaping the flow.
3. **Installers are fulfilment partners.** The customer's relationship is with RENUABL; installer identity is shown for trust, not as a choice to be made.
4. **Post-install is the same product.** My RENUABL is where retention, data and upgrades compound.
