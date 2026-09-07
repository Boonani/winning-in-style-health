# Teaching Motion Audit

Scope: coordinated teaching scenes in the visual primer and the accompanying
motion studies. Principles apply to the whole staged action, not independently
to every CSS property or numeral. Straight-ahead and pose-to-pose are production
methods; this project combines deterministic forward evaluation with authored
poses, not hand-drawn frame-by-frame animation.

## Principle Map

| Principle | Four-player draft | Concept scenes and deck composition | Companion study |
| --- | --- | --- | --- |
| Squash/stretch | Reciprocal pack scaling in flight | Reciprocal actor scale; deck-transfer compression | Enlarged stretch during the pass |
| Anticipation | Held pack winds back before release | Backward windup before forward/lifted motion | Larger preparatory movement |
| Staging | Held and waiting packs occupy separate areas | Bright active card, subdued obstacle, explicit destination | Receiving hand dimmed to isolate the pack |
| Straight-ahead / pose-to-pose | Event queue advances forward; hold/flight/arrival poses | Pure pose evaluator; authored transfer key poses | Visible pose outlines |
| Follow-through / overlap | Card fan counter-rotates; selected card travels separately | Trailing back cards settle after front card | Extra trailing rotation and delayed settling |
| Slow in/out | Smoothstep flight and selected-card easing | Smoothstep arc and eased keyframes | Linear comparison beside eased pass |
| Arcs | Quadratic passing path and lifted chosen card | Analytic lifted paths; deck-transfer lifted pose sequence | Visible curved trajectory |
| Secondary action | Player response after selecting a card | Outcome check / plan-node emphasis; composition ring response | Receiving hand reacts |
| Timing | Four independent pick durations create queues | Finite four-second demonstrations and short deck response | Same distance at different speeds |
| Exaggeration | Windup, lift and settle amplify a small action | Actor lift and rotation make the key action legible | Amplified windup |
| Solid drawing | Multiple offset card backs retain stack thickness | Layered back/front cards and reciprocal scale preserve volume | Expanded stack edges expose thickness |
| Appeal | Friendly players, consistent silhouettes and pack identities | Restrained palette, stable composition and clear outcomes | Balanced pack, color and responsive receiving hand |

The heatmap updates discretely instead of implying a time-dependent mana event.
The qualitative curve is an illustration, not measured probability or quotas.
Typewriter text belongs to the draft scene: individual letters ease into stable
word groups without displacing the table.

## Evidence and Limits
- Pure simulation tests prove FIFO, clockwise direction, conservation of 60 cards,
  independent pick speeds, deterministic event ordering and completion.
- Pose tests cover deterministic coordinates, finite input and volume tolerance.
- Browser tests exercise actual DOM/SVG changes, pause/replay/keyboard behavior,
  correct final outcomes, reduced-motion alternatives and no-JavaScript reading.
- Phone and desktop screenshots were inspected in Chromium and WebKit.
- Long-label tests check 80-character text at 320 pixels, with and without JS.
- A physical iPhone has not been tested. WebKit tests are compatibility evidence,
  not a claim that every iOS version or hardware configuration was exercised.
- Appeal and clarity require visual judgment; passing coordinate tests alone
  cannot prove them. The implementation uses deliberately simple illustrations,
  not a simulation of complete Magic combat.

## Source/Editorial Boundary
Draft lessons use source-grounded paraphrases and literal card evidence, as
recorded in PRIMER-COPY-SOURCES.md. They are not represented as verbatim excerpts
or professional endorsements of Winning in Style. Owner text remains editable.
The exact requested pass-left phrase and Draftmancer action are preserved.
