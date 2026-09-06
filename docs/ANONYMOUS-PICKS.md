# Anonymous Draft Observations

## Player Links

- First pick: https://draft.coolasheck.com/?pick=first
- Last card: https://draft.coolasheck.com/?pick=last
- Owner reports: http://127.0.0.1:8768/stats.html, through Open-Editor.cmd.
- Print: cube-first-pick-card.pdf, cube-last-pick-card.pdf, and
  cube-player-qr-sheet-letter.pdf in print/. The Letter sheet has three of each.
  Print at 100%; each card is 63 x 88 mm.

Each form asks for one listed cube card, the pack (1, 2, or 3), and Magic experience.
Experience scale v1: 0 never played; 1 played once; 2 a few times; 3 about once a
year; 4 a few times per year; 5 every two months or more. This is a rough
self-reported experience/frequency scale, not a skill score.

## What The Data Means

Counts are voluntarily reported first picks or last cards. They are not a pick
rate, win rate, unique-player count, or proof that a card is bad. We do not observe
every pack, opportunity, or missing report. Last cards may be narrow, redundant,
or in colors players were not drafting. Keep this evidence separate from the
dashboard's modeled ratings and external research. Filter by pack, experience,
and recorded cube version; compare sample sizes before drawing conclusions.

The owner view ranks cards by first/last report count and exports all aggregated
counts as CSV. It intentionally has no public leaderboard to influence picks.

## Privacy And Durability

No names, logins, emails, player IDs, IP addresses, or browser details are stored
by this application. No tracking cookies or analytics scripts are used. Records
contain card name, first/last, pack, experience, cube snapshot version, UTC day,
and a random receipt unique to that submission. Receipts prevent duplicate retries
and never link separate responses to one player. A pending receipt and its form
choices remain in this tab's sessionStorage only until confirmation.

Cloudflare necessarily processes network traffic under its own policies. Card
art is optional and loads from its image provider only when opened. We do not
promise infrastructure-wide zero logs or anonymity against a network operator.

SQLite is outside the repository at /home/boon/state/cube-picks/picks.sqlite3.
WAL mode, full synchronous commits, transaction-scoped idempotency, a single-writer
transaction, and daily SQLite API backups protect saved data. Backups are under
the same private state directory. No observation is written to GitHub Pages or Git.

## Services And Boundaries

cube-picks.service starts the public collector on 127.0.0.1:8770 and a separate
read-only statistics listener on 127.0.0.1:8771. Only port 8770 is exposed by the
existing Cloudflare tunnel for draft.coolasheck.com. The public listener cannot
serve statistics, CSV, database files, source files, or the primer editor.

The existing private editor proxies only fixed stats/CSV routes. No writable
authoring API was exposed. Exact Origin, Host, schema/card validation, body limits,
bounded connection workers, 10-second socket timeouts, a 240-requests/minute global
burst limit, and a 10,000-observations/day cap limit accidental/automated misuse
without retaining IPs. Public anonymous forms cannot completely prevent fabricated
responses; these are unverified observations.

## Operations

```bash
cd /home/boon/cube-site/tooling
node picks/build-catalog.mjs
npm test
node picks/verify-ui.mjs
systemctl --user status cube-picks cube-picks-backup.timer
systemctl --user start cube-picks-backup.service
```

The catalog is generated from outputs/analysis.json and stores stable canonical card
names, not changing array indices. After an intentional cube snapshot refresh,
rebuild the catalog, verify it, and restart cube-picks.service. Historical names
and snapshot versions remain in the database.

Browser QA needs the isolated collector on 8772 and stats on 8773; it never submits
into the production database. Runtime database files and Python caches are ignored
by Git. A restore must stop collection, preserve the current database and WAL, restore
a verified SQLite backup, then restart and verify counts. Never overwrite live data
with a test fixture.
