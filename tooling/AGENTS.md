# Cube Tag Tooling

Run CubeArena tag edits, tests, artifact generation and Git publishing on BOONBOX as boon under /home/boon. Windows is supervisory only. This directory owns the Winning in Style tag taxonomy and website generator, not CubeArena engine implementations or factory queues.

Preserve personal tags outside managed namespaces. Do not change card membership when updating tags. Read the current raw cube, back up before live writes, use optimistic version checks, and verify all non-tag card fields after writing. Never commit credentials, session state, local browser output, image caches, or backups.

Semantic tests must be independent of generated tag assignments. Check every card and board, not only mainboard or newly added cards. A verified receipt alone does not prove rules correctness. Keep rules-derived roles distinct from descriptive Scryfall tags and historical research.

Source is in src/, inputs in data/, generated evidence in outputs/. README.md documents portable deployment through DASHBOARD_DEPLOY_DIR. Verify Chromium and WebKit mobile/desktop workflows and public artifact hashes after publication.
