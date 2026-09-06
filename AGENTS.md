# Cube Website

Authoritative working tree: `/home/boon/cube-site` on BOONBOX. Local Windows folder is a synchronized reading/organization checkout; use `$boonbox-linux`, verify `boonbox_status`, and do website edits, builds, tests and Git publication remotely. Keep work separate from CubeArena engine/card-factory campaigns.

Read `docs/REQUEST-20260905.md`, `docs/DESIGN.md`, and `docs/EDITOR.md` before changing primer UX. Preserve Oscar's exact authored copy, intentional blank text, and existing content. Never alter Cube Cobra tags or card membership as a side effect of website work.

One Magic card per row at every viewport. Card art fills the available phone width. Test Chromium and WebKit, reduced motion, no-JavaScript readability, collapse/expand, and editor save/reload/conflicts. WebKit is not a physical iPhone test.

Private authoring runs on loopback port 8768, reached from Windows by `Open-Editor.cmd` over key-only SSH. Never expose the write API through the public domain. Save writes source JSON; publishing must pass the fixed build/test pipeline and verify the public bytes. Keep credentials outside Git and browser code.

Production: https://cube.coolasheck.com/. Primer: /draft-primer.html. QR files: print/. Repository: Boonani/winning-in-style-health. Use the existing repository history rather than creating a competing site repo. The separate Boonani/cube-site-redirect repository only preserves old style.coolasheck.com bookmarks.

Anonymous player observations are the narrowly authorized public-write exception: `tooling/picks/`, public `draft.coolasheck.com` -> loopback 8770, private aggregate listener 8771. Never expose the private primer editor or raw observations. Read `docs/ANONYMOUS-PICKS.md`; preserve `/home/boon/state/cube-picks/picks.sqlite3` and its backups outside Git. No names, accounts, player IDs, IP/user-agent logs, or tracking. Count first/last reports separately by pack, experience, and snapshot; never call these counts a pick rate or unique-player count.

Durable task evidence: `/home/boon/state/cube-site-20260905`. Long work uses remote-task-codex or systemd/tmux with persistent logs. Follow tooling/AGENTS.md for taxonomy and generator boundaries.
