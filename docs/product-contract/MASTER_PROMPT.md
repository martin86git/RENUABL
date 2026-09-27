# Claude Code Master Prompt — RENUABL

You are implementing the RENUABL customer experience and installer portal.

## Primary objective
Build a premium, conversion-focused home-energy platform that does not feel like a conventional solar website.

The design north stars are:
- Apple: simplicity, product confidence, progressive disclosure, clean interaction hierarchy.
- Tesla: direct-to-consumer clarity, configurator mentality, minimal friction.
- Meta/Muse: soft, human, modern, approachable, consumer-friendly.

Do not copy any brand literally. Use these as experience principles only.

## Product rules
1. The customer should not have to become a solar expert.
2. RENUABL recommends the system; the customer can adjust it.
3. RENUABL matches the installer by default. Do not force users to compare installers.
4. Alternative installers may exist behind a secondary link.
5. The customer chooses the installation date.
6. The customer pays a small refundable reservation deposit before the final 15-minute system confirmation.
7. The human call is confirmation, not sales discovery.
8. AI should be present as intelligence, not repeatedly labelled as “AI.” Use “Ask RENUABL”.
9. Post-installation is part of the same product: monitoring, system health, support, upgrades.
10. The interface should minimise decisions, jargon and visible complexity.

## Technical approach
- If an existing repository exists, preserve its framework and conventions.
- If greenfield, use Next.js App Router + TypeScript + Tailwind CSS + accessible headless primitives.
- Build reusable components and shared design tokens.
- Mobile-first responsive implementation, with deliberate desktop layouts rather than stretched mobile screens.
- Do not hard-code business logic into presentational components.
- Mock data is acceptable for first implementation but isolate it behind typed data modules/services.

## Deliverables
Implement four surfaces:
1. Consumer desktop
2. Consumer mobile
3. Installer desktop portal
4. Installer mobile portal

Use the files in this handoff as the product contract. If ambiguity exists, prefer simplicity and the approved design principles over adding new features.
