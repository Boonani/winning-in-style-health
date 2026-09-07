# Beginner research authority

Oscar's supplied 'A Beginner Cube Draft Guide That Teaches Only What Matters' and approved September 7 implementation plan supersede conflicting September 5 copy requirements. The research is the design authority, not evidence that five-color decks are statistically best. Its internal citation tokens are not portable source URLs and are not republished as citations.

Required sequence: draft, fixing, early plays, interaction, breakthrough, plan, 40-card construction. Use 17 lands / 23 nonlands as a starting point, not creature quotas. Two- and three-mana plays are a priority, not precise Sealed curve counts. Fixing permits additional colors. Rough 9/6/3 colored-source targets are optional, explicitly heuristic, and do not guarantee casting, especially double pips or early spells. Cast-dependent fixing is not a land. No Path of Ancestry house rule is assumed.

Keep every existing card example and authored blank Blink text, but move examples and archetypes into native disclosures. Include optional multicolor good-stuff. One card per row, full phone width, no cropping. Preserve private editor boundaries, conflicts, and durable saves.

Canonical route: https://cube.coolasheck.com/primer, served by primer.html through GitHub Pages extensionless routing. draft-primer.html is a static redirect with a no-JavaScript refresh and fallback link. JavaScript preserves query and fragment. Existing private preview URL is retained for compatibility. Publish checks compare /primer bytes to primer.html. Existing printed QR links continue through the redirect; new QR files encode /primer.

The final practice action uses Oscar's exact Draftmancer URL and wording, opens a new tab, and is separate from CubeArena live advice. The app advice is a distinct release; no third-party draft feed is implied.

Verification: npm test; DASHBOARD_DEPLOY_DIR=.. npm run verify:deploy; npm run verify:editor; node src/verify-beginner-ui.mjs; DASHBOARD_DEPLOY_DIR=.. node src/verify-public.mjs. Evidence: /home/boon/state/primer-advice-20260907.
