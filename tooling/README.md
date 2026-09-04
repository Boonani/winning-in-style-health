# Winning in Style Cube Health

## BOONBOX Refactor Workflow

All CubeArena tagging, verification and publishing run on BOONBOX. The tag tools are separate from the game engine; updating tags does not implement newly added cards in the engine. Do not modify game-factory queues or unrelated game worktrees from this workflow.

The published repository retains this source under `tooling/`. From that directory, run `npm ci`, `npm run analyze`, `npm run verify`, and `node --test src/*.test.mjs`. The bundled raw cube and historical research data are reproducible inputs, not claims of current live freshness. `npm run refresh` obtains a fresh cube snapshot. `DASHBOARD_DEPLOY_DIR=.. npm run build:dashboard` writes the website root; use the same environment variable for `npm run verify:deploy`. Without this variable, output goes into `tooling/deploy-site/`.

The live writer checks the entire source snapshot against current rules, requires complete board coverage, preserves personal tags outside managed namespaces, backs up before applying, and checks every non-tag card field afterward. Use `node src/sync-tags.mjs --auth-check` to prove ownership without writing. Credentials belong only in the process environment or a private external configuration, never this repository.

Local verification is not publication proof. After committing the tested site, confirm its exact HTML and data hashes at the public URL and rerun the browser checks with `DASHBOARD_URL=https://style.coolasheck.com/`.

This workspace keeps exhaustive Scryfall data local and builds a strict, evidence-backed draft taxonomy for Cube Cobra.

## Commands

```powershell
npm run refresh
npm run analyze:17lands
npm run research:scryfall
npm run build:dashboard
npm run verify
npm run verify:deploy
npm run verify:visual
npm run tags:dry-run

$env:CUBE_COBRA_LOGIN = [Environment]::GetEnvironmentVariable('CUBE_COBRA_LOGIN', 'User')
$env:CUBE_COBRA_PASSWORD = [Environment]::GetEnvironmentVariable('CUBE_COBRA_PASSWORD', 'User')
npm run tags:apply
```

`refresh` downloads the live Cube Cobra JSON and CSV, then rebuilds every report. The Cube Cobra JSON already contains current Scryfall `oracle_tags` and `art_tags` for each card. Tags nominate cards for review; only type, numeric facts, keywords, and oracle text may assign strict theme roles.

`analyze:17lands` reads the official public CC BY 4.0 Powered Cube draft and game datasets and creates percentile scores for cards with enough games in hand. Those scores are outside evidence from the 2025 Powered Cube, not direct win-rate measurements for Winning in Style.

`research:scryfall` refreshes absent-card candidates for RG Power 4+, RG Power Matters, UG Counters, UG Landfall, GW Counters, UR Artifacts, and GW Enchantments. It also records official Wizards RG precedents.

`tags:dry-run` requires a matching `strict-v2` semantic verification receipt, authenticates, proves account ownership, compares proposed card IDs and indexes to the live cube, and prints the exact edit count without writing.

`tags:apply` repeats those checks, saves timestamped JSON and CSV backups, posts tag-only edits through Cube Cobra's session-backed `/cube/api/commit` endpoint, and verifies every card after the commit. It never sends card-list replacements.

`build:dashboard` deterministically rebuilds both the standalone dashboard and the public-site artifact. `verify:deploy` proves that the HTML and mana assets match. `verify:visual` runs the semantic workflow in Chromium and audits all 20 views in both Chromium and WebKit at iPhone SE, modern iPhone portrait, and modern iPhone landscape sizes, including safe-area geometry, touch targets, form sizing, and overflow.

Blink is deliberately narrow: only intentional exile-and-return is an enabler. Payoffs must demonstrably benefit from actual flicker through a reusable own enter/leave effect, re-preparing, a useful Saga reset, or trigger amplification. Permanent copy, self-bounce/recast, battlefield recursion, graveyard casting, landfall, cast triggers, and triggers caused only by opposing permanents entering are kept separate. The dashboard shows useful adjacent mechanics without silently counting them as Blink.

## Outputs

- `dashboard.html` is the standalone, phone-friendly cube workspace. Its five destinations are Overview, Browse, Health, Review, and Discover. Browse includes a deduplicated All-mainboard view, additive Any/All card types, 17Lands/community sorting, and strict role evidence. Refetch reads the public Cube Cobra list without credentials, while Discover builds visible live Scryfall queries.
- `reports/CUBE_HEALTH_REPORT.md` is the written audit.
- `outputs/theme-health.csv` is the strict theme health table.
- `outputs/strict-overlap.csv` lists every mainboard card's strict theme count, percentage, and accepted themes.
- `outputs/guild-experiments.csv` compares the RG, UG, and GW experiment densities and packet visibility.
- `outputs/rejected-scryfall-nominations.csv` lists Scryfall discoveries that failed the strict role rules.
- `outputs/semantic-verification.json` is the version-matched receipt required before the writer will authenticate or apply.
- `outputs/17lands-card-scores.csv` maps every current mainboard card to public Powered Cube evidence when available.
- `outputs/instant-sorcery-specific-cards.csv` is the exact list of cards whose text specifically mentions instants or sorceries.
- `outputs/card-tag-map.csv` lists every card, Scryfall tag, derived tag, tribe, theme role, quality estimate, and proposed Cube Cobra tag.
- `outputs/card-taxonomy-audit.jsonl` records Oracle text, faces, descriptive metadata, adjacent mechanics, and every assigned/unassigned role decision for all boards. `outputs/taxonomy-audit-packets/` contains the same evidence in 100-card review packets.
- `outputs/new-card-findings.json` records the exact v551-to-v555 additions/removals and every new occurrence's strict roles, adjacent mechanics, Oracle text, and uncertainty notes.
- `outputs/taxonomy-audit-summary.json` records board coverage and the total role-decision count.
- `outputs/card-quality.csv` lists every card's standalone tier, estimated average and best-case material advantage, instant/flash combat role, and CubeCobra ELO signal.
- `outputs/pack-visibility.csv` contains exact hypergeometric visibility math for eight 15-card packets.
- `outputs/proposed-live-tags.json` is the guarded write proposal. It is not evidence that tags were applied.
- `backups/` contains immutable pre-write snapshots.

The public Cube Cobra API is read-only for this workflow. The current site has a private authenticated commit route used by its own list editor; that route is intentionally isolated behind the guarded writer instead of treated as a stable public API.

On BOONBOX, rebuild and verify without credentials or live writes:

```bash
npm ci
npm run analyze
npm run verify
npm run verify:deploy
npm run verify:visual
```

## Reading Card Quality

The card-quality model is deliberately heuristic. It separates raw material advantage from tempo: a one-for-one removal spell is `0` card advantage even when it is an excellent card, while a permanent that replaces itself is approximately `+1`. Best-case sweeper values assume your opponent loses the relevant permanents and your own losses are minimal. CubeCobra community ELO is supporting evidence, not a substitute for testing this specific environment.
