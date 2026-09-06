# Anonymous Picks Release Verification

- Public collector: https://draft.coolasheck.com/
- Direct QR routes: /?pick=first and /?pick=last.
- Private reports: existing loopback editor /stats.html and fixed aggregate CSV export.
- Catalog: 953 unique mainboard card names from cube snapshot v558. Duplicate
  copies share a card-name count; the underlying 1,004 slots were not changed.
- 149 Node test cases passed, including a Python integration suite with seven cases:
  durable/repeated saves, concurrent retries, strict schema, HTTP boundaries,
  pack/experience/version aggregation, SQLite backup/no identity columns, static CSP.
- Chromium and WebKit at 320 x 568, 390 x 844, 844 x 390, and 1440 x 1000:
  first and last submissions, experience zero, autocomplete keyboard selection,
  stats filters, no page overflow, and no runtime errors.
- Both engines: response deliberately lost after insertion, page reloaded, retry
  reused the same submission receipt and did not count a second observation.
- Existing editor: eight browser profiles passed consecutive saves, reload,
  printing selection, and publication locking after the stats integration.
- Public route: real submissions from both engines, optional full-width card art,
  private stats/source paths return 404; accepted records survived service restart.
- Both controlled test records were removed by exact generated receipt IDs after
  a private backup. Launch statistics contain zero test responses.
- Daily backup timer enabled and an initial clean SQLite backup completed.
- QR PDFs rendered and visually reviewed; individual codes and all six codes on
  the paired Letter sheet decoded to their exact first/last URLs.
- Public form HTML, JavaScript, stylesheet, and catalog match local source;
  no Set-Cookie header. Main Pages assets/QR hashes are checked after Git push.

Durable evidence: /home/boon/state/cube-picks-20260905/. Public observations and
daily backups: /home/boon/state/cube-picks/. Neither directory is in the repository.

Limitations: browser emulation is not physical iPhone testing; voluntary anonymous
observations can be fabricated or incomplete. No unique-player identity is inferred.
Network providers process traffic under their policies; the app stores no IPs.
