# Cube Primer Design

## Direction

The primer is phone-first, quiet, and visual. It uses the installed system sans-serif stack so type remains crisp and familiar on iOS, Android, macOS, and Windows without a font download. Mint, blue, gold, and violet create a meaningful teaching hierarchy against a near-black canvas.

Text stays inside a readable gutter. Card artwork deliberately breaks out to the full viewport width at phone and phone-landscape sizes. Every card gallery uses exactly one column on every viewport. Images retain their natural card aspect ratio with `object-fit: contain`; no card artwork is cropped and no card section receives decorative rounded corners.

## Teaching model

The copy follows the George Fan review lens in [REQUEST-20260905.md](REQUEST-20260905.md): show the visual first, explain one idea at a time, keep prompts short, and move optional depth into native disclosure controls. The approximate eight-word prompt budget is a lens, not a grammar-breaking quota.

The removal section contains the owner-requested sentence exactly once:

> Games are often won based on who is able to interact more.

The old removal heading and redundant advice are absent. The Blink section keeps the small heading `Blink`, shows its examples, and intentionally renders no introductory body until the owner authors it. The primer does not define payoff or enabler.

## Motion

`tooling/src/site-motion.mjs` is shared by the primer and analytics dashboard. Source content is fully visible before JavaScript runs. With motion available, content eases in as it enters and becomes transparent only after reaching a viewport edge. Text remains fully opaque through the reading area. Mana bars rise from their baseline.

Native `details` elements retain keyboard and focus behavior. Their height animation handles open and close, cancels safely when toggled rapidly, and never scrolls the page. `prefers-reduced-motion: reduce` disables movement and forces teaching content visible.

## Card printings

Displayed primer printings are stable Scryfall UUIDs in `tooling/data/primer-content.json`. Artwork URLs are derived from those UUIDs on the fixed `cards.scryfall.io` host; arbitrary image URLs are neither stored nor accepted.

Swords to Plowshares uses Marvel Super Heroes `MSC 143`, Scryfall UUID `b4e9c870-23c0-413a-ae39-265f09da16d1`. The Scryfall API was consulted on September 5, 2026. It is an English, normal-layout printing released June 26, 2026 with a complete high-contrast rules box and current Oracle text. The full API-derived provenance is recorded beside the authoring content.

## Boundaries

This frontend changes presentation and primer authoring only. It does not change cube membership, tags, or live printings. The editor is not copied into the public deployment. Browser checks cover Chromium and WebKit emulation; they are not claims of physical iPhone testing.
