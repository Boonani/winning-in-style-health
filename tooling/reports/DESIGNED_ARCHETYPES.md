# Designed Archetypes

Design hierarchy follows the ten color pairs in Winning in Style's Cube Cobra primer, with Oscar's newer Gruul power-four emphasis. Blink is first. Detected themes are not silently substituted for these intended pairs. No cards or tags were changed by this release.

## Metrics

- In-pair means every color in the card's color identity is in the selected pair. Colorless is optional and on by default. This is conservative, not a full mana-castability model.
- Role cards come from existing strict taxonomy. The new dashboard does not broaden that taxonomy. Rakdos uses the artifact-sacrifice subset; the exact rule is in designed-archetypes.mjs and is documented in its disclosure.
- The role donut partitions unique cards into payoff-only, enabler-only and both. Its ratio uses each role total; both-role cards appear in each total but only once in the donut.
- The creature donut and mana curve exclude all lands. Artifact creatures are creatures, not counted twice.
- Heatmap numbers are counts. Shading shows support per 100 in-pair cards on a fixed 0 to 15+ scale, with no claimed win rate. Intersections show the actual shared card slots between cores and use a separate fixed 0 to 20+ scale.
- Fewer than six inputs or rewards is a transparent review flag, not a universal ideal or strength rating. Theft can win through its input engines without separate theft rewards; that exception is stated visibly.
- Gruul early support retains the existing MV <=3 rule. Large or off-color creatures cannot inflate that core. Pair scopes always keep off-color options separate.

## Research Applied

Apple Human Interface Guidelines, Charts: https://developer.apple.com/design/human-interface-guidelines/charts
Apple, Design an Effective Chart: https://developer.apple.com/videos/play/wwdc2022/110340/
Datawrapper, Choosing a Chart Type: https://www.datawrapper.de/blog/chart-types-guide
Datawrapper, Heatmaps for Tables: https://www.datawrapper.de/blog/heatmaps-for-tables

Use focused views, direct count labels, accessible descriptions, restrained color, real card art and progressive disclosure. Donuts answer composition questions, bars compare mana costs, and matrices expose support gaps and intersections. Avoid a decorative force graph as the primary exact comparison.

## Beginner Primer

Wizards, Booster Draft: https://magic.wizards.com/en/formats/booster-draft
Wizards, How to Build a Mana Curve: https://magic.wizards.com/en/news/feature/how-build-mana-curve-2017-05-18
Wizards, Signals in Booster Draft: https://magic.wizards.com/en/news/feature/signals-booster-draft-2015-01-19
Wizards, Bloomburrow Prerelease Guide: https://magic.wizards.com/en/news/feature/bloomburrow-prerelease-guide

The deck recipe is a starting example, not a quota: 17 lands + 15 creatures + 8 other spells =40. Removal belongs within those slots. Curve illustration totals 15 creatures and is explicitly an example. Two colors first; splash only with reliable mana. Normal cube draft, not Commander draft. All primer example cards must be current mainboard members fitting that core.

Cube Cobra's native image rows use <<[[!Card|ID]]...>>. No bare card hyperlinks or mono-color primer section. The writer backs up before updating only description and verifies every other meaningful cube field afterward; Cube Cobra's description route has no server-side version-lock parameter.
