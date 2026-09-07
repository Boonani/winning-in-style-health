# Live Primer Motion

## Current Scope
Worktree: /home/boon/cube-motion-20260907
Branch: codex/live-primer-motion
Base: d46d59e
Evidence: /home/boon/state/primer-motion-20260907

The primer includes a four-player first-pack lesson, mana-source heatmap,
qualitative curve, three concept scenes, and a 40-card composition chart.
The companion motion studies cover the twelve requested principles. See
PRIMER-MOTION-AUDIT.md for the implementation map and verification limits.
This is independent of the larger CubeArena advice addition.

## Brand
Three brand accents:
- Rose: RGB(255, 148, 172), #FF94AC. Replaces the hard-to-see red at Oscar's request.
- Aqua: RGB(69, 214, 197), #45D6C5. Mana support, continuity and passing paths.
- Yellow: RGB(255, 209, 102), #FFD166. Attention, open choices and supporting comparisons.

Neutral canvas #090C12, surfaces #12161B, text #F7F8FA.
Use rose for emphasis, with dark lettering on rose-filled cards. Contrast must
be tested at the actual size before use. Pair color with labels, shapes
or patterns: pack identifiers A-D and explicit counts distinguish the packs.
No hue is assigned to a Magic mana color; actual mana symbols retain their
conventional identities.

Use system sans-serif. No negative tracking. Fixed type sizes and natural word
wrapping. A diagram is the main explanation; brief prose supplies the reason
and catches ambiguity. Charts must distinguish measured data from illustration.
Never present an illustrative curve as an exact creature or spell quota.

## Four-Player Lesson
Clockwise on the screen is each inward-facing player's left.
Four distinct pick speeds produce real FIFO queues. A player finishes choosing
before opening the next waiting pack. The simulation conserves all 60 cards.
A four-player schematic explains direction; it does not prescribe pod size.

The instruction is sections[draft].heading in primer-content.json and remains
editable through the existing private editor. The requested initial wording is:
Pick 1 card, pass the pack to the left

Controls do not affect live drafting, bots, deck contents or game rules.
No video or GIF is fetched. Rendering is inline SVG/DOM and requestAnimationFrame.
Reduced motion starts static and supports discrete next-pick steps.
Without JavaScript the initial diagram and its text explanation remain readable.
Playback is user-initiated and pauses advancing when offscreen or hidden.

## Twelve Principles: Implementation Review
Reference: https://www.clipstudio.net/en/animation/12-principles/
The following are implementation choices, not quotations.

1. Squash/stretch: passing packs scale reciprocally on the two axes.
2. Anticipation: a held pack winds back immediately before the pick.
3. Staging: the active pack stays in the hand area; waiting packs sit beside it.
4. Straight-ahead/pose-to-pose: deterministic events advance the simulation;
   authored hold, flight and arrival poses anchor interpolation. These are
   construction methods, not a claim that every frame is hand-drawn.
5. Follow-through/overlap: trailing card backs rotate separately from the pack;
   the selected card travels while the remaining pack moves onward.
6. Slow in/out: smoothstep interpolation eases flight and the selected card.
7. Arcs: passing uses a quadratic path; the selected card lifts on a sine arc.
8. Secondary action: the choosing player gives a small bounce after the pick.
9. Timing: independently paced players make the queue behavior legible.
10. Exaggeration: the pre-pick windup and selected-card lift amplify a small act.
11. Solid drawing: offset back cards and reciprocal scaling retain stack volume.
12. Appeal: faceless circle heads and simple torsos, with no arms. A grounded,
    reciprocal squash/stretch after each pick expresses a small happy response.

motion-studies.html now provides twelve selectable studies with a play/pause
control and scrubber. Each shares the same coordinated pass, emphasizing the
selected principle. Chromium and WebKit tests cover every mode, mobile and
desktop, reduced motion, and no-JavaScript reading. Visual treatment remains
an initial implementation, not a claim of final art approval.

## Copy Authority
Use source-grounded paraphrases, not wholesale copied guide prose.
Short quotations must be attributed. Operational labels and Oscar's requested
wording are not misrepresented as quotations from a professional player.

- Reid Duke, The Basics of Booster Draft:
  https://magic.wizards.com/en/news/feature/basics-booster-draft-2014-11-03
  Supports picking/passing, a coherent plan, curve, and treating late cards as
  information rather than certainty.
- Zach Barash, Planar Cube Draft, How to Draft Planar Cube:
  https://magic.wizards.com/en/news/mtg-arena/planar-cube-draft
  Supports mana consistency, interaction, and optional multicolor good-stuff.
  Its rotating cube specifics do not describe Winning in Style.
- Oscar's beginner research in BEGINNER-RESEARCH-20260907.md takes precedence
  over incompatible older guide advice. Preserve 17 lands + 23 nonlands,
  fixing-dependent colors and conditional source accounting.

PRIMER-COPY-SOURCES.md records the copy review and the distinction between
source-grounded paraphrases, owner wording and card-specific applications.
Release requires the combined browser/editor gates and public artifact parity.
The private editor's eight viewport/engine save/reload scenarios passed on
2026-09-07, including the new editable animation heading.
