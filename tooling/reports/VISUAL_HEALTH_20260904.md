# Visual Cube Health and Updates

## Delivered

- Theme size and color support in Overview, on a shared count-proportional circle-area scale.
- Solid enabler circles and cross-hatched payoff circles; theme and color/role drilldowns open the matching cards.
- White, blue, black, red, green and colorless support remain visible on mobile without horizontal panning. Multicolor cards contribute to each color identity; per-role totals count each card slot once.
- Browse keeps primary theme/role/search controls visible and places secondary evidence, filters and statistics under Advanced.
- Existing mana curve, color balance, card types and functions preserved. Overview metrics navigate to relevant views.
- Updates offers 7-day, 30-day, 90-day and all-history ranges, grouped by day, week or month. Real card art and recorded replacement pairs are linked to their source changelog.
- Complete available mainboard history: 540 list-changing events from 2025-10-27 onward. Tag-only and printing-only edits are omitted; independently added and removed cards are never invented into pairs. Net additions reconcile to 1,004 current mainboard slots.

## Corrected Semantics

The old visible Dies category is now Aristocrats. Its enablers are low-cost expendable or recurring bodies; its payoffs consume other creatures or reward creature deaths. Generic creatures and artifact-only sacrifice abilities are not support. Yawgmoth and Diabolic Intent are payoffs. Professional Facebreaker's Treasure outlet and Legion Extruder's artifact outlet do not qualify.

Power 4+ inputs require printed four-or-greater power at mana value three or less, or an early unconditional large-token spell. Obvious delayed creature activation and entry self-sacrifice are excluded. Power Matters additionally accepts low-cost conditional scaling bodies, labeled as conditional evidence rather than guaranteed four-power support. Expensive finishers retain descriptive power tags without inflating early support. This is an explicit conservative strategic policy, not a claim that printed mana value alone proves an actual turn of deployment.

The corrected RG snapshot has two early four-power inputs versus six threshold rewards. Health descriptions now reflect the actual counts instead of asserting the lane must already be balanced.

## Live Cube

- Version 556 -> 557 corrected the single requested identity: Cloak and Dagger (Equipment) -> Cloak and Dagger, Entwined (Marvel creature). Recorded as a real swap.
- Version 557 -> 558 updated tags on 223 slots, checked all 1,058 slots, with zero tag mismatches and zero unrelated/non-tag changes.
- Fresh version 558 dry run: zero remaining edits; 3,752 managed/custom tag assignments.
- Mainboard 1,004, maybeboard 49, basics 5. All other memberships, printing choices and personal fields preserved.

## Verification and Operation

125 focused tests plus 113 semantic fixtures / 166 assertions passed. Chromium and WebKit desktop/mobile workflows, 21 views, reduced motion, circle geometry, readable labels, real images and canvas checks passed before publication. Public parity and final deployment receipts are stored on BOONBOX under `/home/boon/state/cube-visual-health-20260904`.

Run on BOONBOX from `tooling/`: `DASHBOARD_DEPLOY_DIR=.. npm run refresh`, `npm test`, `npm run verify`, `npm run verify:visual`, and `DASHBOARD_DEPLOY_DIR=.. npm run verify:deploy`. Refresh now obtains dated changelog history as well as the card snapshot. Existing authenticated, backed-up, version-checked tag synchronization remains separate from site publication.

This change owns cube analysis and the website, not CubeArena game-engine card implementations. No game-engine checkout was changed.
