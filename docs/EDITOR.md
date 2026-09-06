# Cube Primer Editor

## Open

On Oscar's Windows computer, run `Open-Editor.cmd` in `C:\Users\Oscar\Documents\Cube`.
It opens a private SSH tunnel to BOONBOX, then opens
`http://127.0.0.1:8768/editor.html`. Tunnel logs live in `%LOCALAPPDATA%\CubeEditor`.

The editor service starts automatically on BOONBOX. Its write API binds only to
127.0.0.1, not the public website. A phone can read the public primer; private
authoring requires an authenticated tunnel to BOONBOX. No credentials enter the browser.

## Save And Publish

Edit text, move cards with arrow buttons or the section menu, add/remove examples,
and choose an English Scryfall printing. Blank Blink paragraphs are intentional.

1. **Save draft** validates the versioned JSON, makes a private backup, and regenerates
   the preview. Saving is durable but does not change the public website.
2. **Publish** runs the fixed build/test/deploy checks, commits the approved content
   files, pushes main, and compares the public primer's SHA-256 with the saved output.
3. The status becomes **Live** only after that exact public file is verified.

Another browser's stale save returns 409 instead of overwriting newer work.
Edits are frozen during save/publication. A failed publication preserves the saved
draft and can be retried after the underlying error is repaired. No test copy is
written to the real source during automated browser tests.

Source: `tooling/data/primer-content.json`.
Private backups: `/home/boon/state/cube-site-20260905/primer-backups`.
Publication log/status: `/home/boon/state/cube-site-editor/publish.log` and `publish.json`.

## Security And Recovery

The private HTTP server checks the exact Host on all routes and exact Origin on
writes. Its static allowlist excludes Git, source, arbitrary paths, and secrets.
The repository itself is public, so its source/editor HTML are not confidential;
the private write API and authenticated publishing service are the security boundary.

The API can start only the fixed systemd publishing service. That service accepts
only changes to the primer JSON and its two generated outputs, rejects unpublished
code changes, uses a process lock, and never invokes a Cube Cobra write endpoint.
Code changes require a separate reviewed release.

BOONBOX commands:

```bash
systemctl --user status cube-primer-editor cube-primer-publish
journalctl --user -u cube-primer-editor -n 50
systemctl --user restart cube-primer-editor
```

After a published edit, update the Windows mirror with `git pull --ff-only`.
Do not edit the mirror and BOONBOX source independently.

## Verification

```bash
cd /home/boon/cube-site/tooling
npm test
DASHBOARD_DEPLOY_DIR=.. npm run build:dashboard
DASHBOARD_DEPLOY_DIR=.. npm run verify:deploy
npm run verify:editor
node src/verify-design-ui.mjs
```

Tests use disposable editor source/preview files, fake publication, and fixture
printing responses. Final release checks also exercise the real private service
and public deployment. Browser QA uses Chromium and WebKit emulation, not a physical iPhone.
