import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STRICT_THEMES,
  derivedLocalTags,
  functionalRoleMatches,
  nominationMatches,
  normalizeCard,
  playableIn,
  strictRoleMatches,
  strictRoleReview,
  taxonomyHelpers,
} from './taxonomy.mjs';
import { renderDashboard } from './dashboard.mjs';
import { classifyCardQuality } from './card-quality.mjs';
import { chanceAtLeastOne, packVisibility } from './pack-math.mjs';
import { V555_CHANGES } from './taxonomy-v555-changes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data', 'raw');
const outputDir = path.join(root, 'outputs');
const reportDir = path.join(root, 'reports');
const cubeId = 'style';
const baseUrl = 'https://cubecobra.com';
const userAgent = 'WinningInStyleCubeHealth/1.0 (+https://cubecobra.com/cube/about/style)';
const seventeenLandsPath = path.join(root, 'data', '17lands', 'powered-cube-ratings.json');
const researchPath = path.join(root, 'data', 'research', 'scryfall-candidates.json');
const userRequestedRemovals = [
  'All That Glitters',
  'Eidolon of Blossoms',
  'Sanctum Weaver',
  'Setessan Champion',
];
const userRequestedRemovalNames = new Set(userRequestedRemovals.map((name) => name.toLowerCase()));

const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join(';') : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (headers, rows) =>
  `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\n')}\n`;

const round = (value, digits = 2) => Number(value.toFixed(digits));
const normalizeName = (value) => String(value ?? '').split(' // ')[0].trim().toLowerCase();
const ratio = (a, b) => (b === 0 ? (a ? 'inf' : '0.00') : (a / b).toFixed(2));
const unique = (cards) => [...new Map(cards.map((card) => [`${card.board}:${card.index}`, card])).values()];
const statusFor = (score) => (score >= 80 ? 'Strong' : score >= 65 ? 'Healthy' : score >= 50 ? 'Playable' : score >= 35 ? 'Fragile' : 'Unsupported');
const percentileRanker = (values) => {
  const ranked = values.filter(Number.isFinite).sort((a, b) => a - b);
  return (value) => {
    if (!Number.isFinite(value) || ranked.length < 2) return null;
    let low = 0;
    let high = ranked.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (ranked[middle] <= value) low = middle + 1;
      else high = middle;
    }
    return round((low * 100) / ranked.length, 1);
  };
};
async function fetchText(url) {
  const response = await fetch(url, { headers: { Accept: '*/*', 'User-Agent': userAgent } });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  return response.text();
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function refreshRawData() {
  await fs.mkdir(rawDir, { recursive: true });
  const [cubeJson, cubeCsv, aboutHtml] = await Promise.all([
    fetchText(`${baseUrl}/cube/api/cubeJSON/${cubeId}`),
    fetchText(`${baseUrl}/cube/download/csv/${cubeId}`),
    fetchText(`${baseUrl}/cube/about/${cubeId}`),
  ]);
  JSON.parse(cubeJson);
  try {
    const previous = JSON.parse(await fs.readFile(path.join(rawDir, 'cube.json'), 'utf8'));
    const next = JSON.parse(cubeJson);
    // Tag-only commits must not erase the last card-list comparison.
    const membership = (cube) => JSON.stringify(Object.entries(cube.cards).filter(([, entries]) => Array.isArray(entries)).sort(([a], [b]) => a.localeCompare(b)).map(([board, entries]) => [board, entries.map((entry) => entry.cardID).sort()]));
    if (membership(previous) !== membership(next)) await fs.writeFile(path.join(rawDir, 'previous-cube.json'), `${JSON.stringify(previous, null, 2)}\n`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await Promise.all([
    fs.writeFile(path.join(rawDir, 'cube.json'), cubeJson),
    fs.writeFile(path.join(rawDir, 'cube.csv'), cubeCsv),
    fs.writeFile(path.join(rawDir, 'about.html'), aboutHtml),
  ]);
}

function frequency(cards, key) {
  const counts = new Map();
  for (const card of cards) {
    for (const tag of card[key]) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function classifyThemes(mainboard) {
  const scale = mainboard.length / 360;
  const colorGroups = [
    ['W'], ['U'], ['B'], ['R'], ['G'],
    ['W', 'U'], ['U', 'B'], ['B', 'R'], ['R', 'G'], ['W', 'G'],
    ['W', 'B'], ['U', 'R'], ['B', 'G'], ['W', 'R'], ['U', 'G'],
  ];
  return STRICT_THEMES.map((theme) => {
    const matchesByCard = new Map(mainboard.map((card) => [`${card.board}:${card.index}`, strictRoleMatches(theme, card)]));
    const roleCards = Object.fromEntries(Object.keys(theme.roles).map((roleName) => [
      roleName,
      mainboard.filter((card) => matchesByCard.get(`${card.board}:${card.index}`).some((match) => match.role === roleName)),
    ]));
    const allSupport = unique(Object.values(roleCards).flat());
    const targets = { enablers: Math.round(10 * scale), payoffs: Math.round(5 * scale) };
    const enablers = roleCards.enablers.length;
    const payoffs = roleCards.payoffs.length;
    const glue = roleCards.glue.length;
    const colorScores = colorGroups.map((colors) => {
      const eligible = mainboard.filter((card) => playableIn(card, colors));
      const e = roleCards.enablers.filter((card) => playableIn(card, colors)).length;
      const p = roleCards.payoffs.filter((card) => playableIn(card, colors)).length;
      const g = roleCards.glue.filter((card) => playableIn(card, colors)).length;
      return { colors, e, p, g, score: (Math.min(e, p * 2) + p * 1.5 + g * 0.25) / Math.max(1, eligible.length) };
    }).sort((a, b) => b.score - a.score || b.p - a.p || b.e - a.e);
    const best = colorScores[0];
    const focusColors = theme.focusColors ?? best.colors;
    const focus = colorScores.find((entry) => entry.colors.join('') === focusColors.join('')) ?? best;
    const balance = payoffs === 0 ? 0 : Math.min(1, payoffs / Math.max(1, enablers * 0.25));
    const rawScore = Math.round(100 * (
      0.3 * Math.min(1, enablers / targets.enablers) +
      0.55 * Math.min(1, payoffs / targets.payoffs) +
      0.15 * balance
    ));
    const scaledPayoffs = payoffs / scale;
    const payoffCap = scaledPayoffs < 1 ? 34 : scaledPayoffs < 2 ? 49 : scaledPayoffs < 4 ? 64 : scaledPayoffs < 6 ? 79 : 100;
    const score = Math.min(rawScore, payoffCap);
    const rejectedNominations = mainboard
      .map((card) => ({ card, tags: nominationMatches(theme, card) }))
      .filter(({ card, tags }) => tags.length && matchesByCard.get(`${card.board}:${card.index}`).length === 0)
      .map(({ card, tags }) => ({ id: `${card.board}:${card.index}`, name: card.name, tags }));
    return {
      id: theme.id,
      name: theme.name,
      colors: focusColors,
      bestColors: best.colors,
      focusColors,
      focusRoleCounts: { enablers: focus.e, payoffs: focus.p, glue: focus.g },
      sourceTags: theme.nominationTags,
      description: theme.description,
      eligibleCards: mainboard.length,
      enablers,
      payoffs,
      glue,
      enablerPayoffRatio: ratio(enablers, payoffs),
      supportCards: allSupport.length,
      supportPer45: round((allSupport.length * 45) / mainboard.length),
      score,
      status: statusFor(score),
      rejectedNominations,
      roleCards: Object.fromEntries(Object.entries(roleCards).map(([key, cards]) => [key, cards.map((card) => card.name)])),
      roleCardIds: Object.fromEntries(Object.entries(roleCards).map(([key, cards]) => [key, cards.map((card) => `${card.board}:${card.index}`)])),
      roleEvidence: Object.fromEntries(Object.keys(theme.roles).map((roleName) => [roleName, roleCards[roleName].map((card) => {
        const match = matchesByCard.get(`${card.board}:${card.index}`).find((item) => item.role === roleName);
        return { id: `${card.board}:${card.index}`, ruleId: match.ruleId, reason: match.reason };
      })])),
      supportIds: allSupport.map((card) => `${card.board}:${card.index}`),
    };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function blinkByColor(mainboard) {
  return ['W', 'U', 'B', 'R', 'G', 'C'].map((color) => {
    const cards = mainboard.filter((card) =>
      color === 'C' ? card.colors.length === 0 : card.colors.length === 1 && card.colors[0] === color,
    );
    const flicker = cards.filter(taxonomyHelpers.isFlicker);
    const copy = cards.filter(taxonomyHelpers.isPermanentCopy);
    const recursion = cards.filter(taxonomyHelpers.isBattlefieldRecursion);
    const selfBounce = cards.filter(taxonomyHelpers.isSelfBounce);
    const adjacent = unique([...copy, ...recursion, ...selfBounce]);
    const enablers = flicker;
    const payoffs = cards.filter(taxonomyHelpers.isBlinkHardPayoff);
    const coverage = enablers.length >= 12 ? 'Strong' : enablers.length >= 7 ? 'Healthy' : enablers.length >= 3 ? 'Playable' : enablers.length >= 1 ? 'Fragile' : 'Unsupported';
    return {
      color,
      flicker: flicker.length,
      copy: copy.length,
      recursion: recursion.length,
      selfBounce: selfBounce.length,
      adjacent: adjacent.length,
      enablers: enablers.length,
      payoffs: payoffs.length,
      ratio: ratio(enablers.length, payoffs.length),
      coverage,
      examples: enablers.slice(0, 6).map((card) => card.name),
      adjacentExamples: adjacent.slice(0, 6).map((card) => card.name),
    };
  });
}

function buildTaxonomyAudit(cards) {
  return cards.map((card) => {
    const themes = STRICT_THEMES.map((theme) => {
      const roles = strictRoleReview(theme, card);
      const assignedRoles = roles.filter((role) => role.assigned).map((role) => role.role);
      const nominations = nominationMatches(theme, card);
      return {
        themeId: theme.id,
        theme: theme.name,
        definition: theme.description,
        assigned: assignedRoles.length > 0,
        assignedRoles,
        nominations,
        roles,
      };
    });
    const uncertainties = [];
    if (card.faceCount > 1) uncertainties.push('Multi-face card: Cube Cobra supplies combined Oracle text but only the displayed face type line; type-based roles use that supplied type line.');
    if (taxonomyHelpers.hasAmbiguousPower(card)) uncertainties.push('Variable printed power is not treated as numeric Power 4+ evidence.');
    if (card.inactiveInCubeFormat) uncertainties.push('Printed Commander-dependent text is inactive in this cube unless replaced by cube-specific rules text.');
    const rejectedNominations = themes.filter((theme) => theme.nominations.length && !theme.assigned).map((theme) => theme.themeId);
    if (rejectedNominations.length) uncertainties.push(`Scryfall nominated but strict rules rejected: ${rejectedNominations.join(', ')}.`);
    return {
      id: `${card.board}:${card.index}`,
      board: card.board,
      index: card.index,
      cardID: card.cardID,
      oracleId: card.oracleId,
      name: card.name,
      type: card.type,
      layout: card.layout,
      faceCount: card.faceCount,
      oracleText: card.oracleText,
      printedOracleText: card.printedOracleText,
      cubeOracleText: card.cubeOracleText,
      oracleTags: card.oracleTags,
      artTags: card.artTags,
      derivedTags: card.localTags,
      existingCubeCobraTags: card.existingTags,
      preservedCustomTags: card.existingTags.filter((tag) => !managedPrefixes.some((prefix) => tag.startsWith(prefix))),
      adjacentMechanics: taxonomyHelpers.adjacentMechanicMatches(card),
      themes,
      reviewedThemeCount: themes.length,
      acceptedThemeCount: themes.filter((theme) => theme.assigned).length,
      status: uncertainties.length ? 'reviewed-with-notes' : 'reviewed',
      uncertainties,
    };
  });
}

function tribeCensus(mainboard) {
  const bodies = new Map();
  for (const card of mainboard) {
    for (const type of card.creatureTypes) bodies.set(type, (bodies.get(type) ?? 0) + 1);
  }
  return [...bodies.entries()]
    .map(([type, count]) => {
      const tag = `typal-${type.toLowerCase()}`;
      const payoffs = mainboard.filter((card) => card.oracleTags.includes(tag)).length;
      const signal = count >= 15 && payoffs >= 4 ? 'Draftable' : count >= 10 && payoffs >= 2 ? 'Subtheme' : count >= 15 ? 'Bodies only' : 'Incidental';
      return { type, bodies: count, payoffs, signal };
    })
    .sort((a, b) => b.bodies - a.bodies || b.payoffs - a.payoffs || a.type.localeCompare(b.type));
}

function computeOverlaps(themes) {
  const rows = [];
  for (let i = 0; i < themes.length; i += 1) {
    for (let j = i + 1; j < themes.length; j += 1) {
      const left = new Set(themes[i].supportIds);
      const right = new Set(themes[j].supportIds);
      const shared = [...left].filter((id) => right.has(id)).length;
      const smaller = Math.min(left.size, right.size) || 1;
      if (shared) rows.push({ a: themes[i].name, b: themes[j].name, shared, percent: Math.round((shared / smaller) * 100) });
    }
  }
  return rows.sort((a, b) => b.shared - a.shared || b.percent - a.percent);
}

const managedPrefixes = [
  'Blink:', 'Theft:', 'Artifact Sac:', 'Big Mana:', 'GW Growth:', 'Aristocrats:', 'Noncombat Damage:',
  'Graveyard:', 'Humans:', 'Counters:', 'Stax:', 'Control:', 'Black Aggro:', 'Red Aggro:', 'Chonkers:',
  'Strict ', 'Function:',
];

function proposedTagsFor(card) {
  const tags = card.existingTags.filter((tag) => !managedPrefixes.some((prefix) => tag.startsWith(prefix)));
  for (const theme of STRICT_THEMES) {
    for (const match of strictRoleMatches(theme, card)) tags.push(match.liveTag);
  }
  for (const match of card.functionRoles) tags.push(match.liveTag);
  return [...new Set(tags)].sort();
}

function reportMarkdown(data) {
  const weakest = [...data.themes].sort((a, b) => a.score - b.score).slice(0, 4);
  const strongestHidden = data.hiddenThemes.filter((x) => x.signal === 'Strong').slice(0, 5);
  const blinkGaps = data.blink.filter((x) => ['Fragile', 'Unsupported'].includes(x.coverage));
  const cardById = new Map(data.cards.map((card) => [card.id, card]));
  const instantSorceryNames = data.diagnostics.instantSorcerySpecificIds.map((id) => cardById.get(id)?.name).filter(Boolean);
  const cutCandidates = data.seventeenLands.cutCandidateIds.map((id) => cardById.get(id)).filter(Boolean).slice(0, 20);
  const rows = (items, columns) => items.map((item) => `| ${columns.map(([key, render]) => render ? render(item[key], item) : item[key]).join(' | ')} |`).join('\n');
  return `# ${data.cube.name} - Cube Health Report

Generated: ${data.generatedAt}  
Cube Cobra version: ${data.cube.version}  
Mainboard: ${data.cube.mainboardCount} cards; maybeboard: ${data.cube.maybeboardCount}; recorded decks: ${data.cube.numDecks}

## Verdict

This is a **structural synergy audit**, not a win-rate claim. Cube Cobra currently has only ${data.cube.numDecks} recorded decks for this cube, so there is not enough play data to say which archetype wins most often. The reliable evidence is card density, enabler/payoff balance, color access, Scryfall tag coverage, and how often cards bridge multiple themes.

The local tool is the right home for exhaustive Scryfall data: it preserves ${data.summary.oracleTagCount} oracle tags (${data.summary.oracleTagAssignments} card-tag assignments) and ${data.summary.artTagCount} illustration tags without flooding Cube Cobra with more than a thousand category names.

The theme list below is rebuilt from Scryfall oracle tags and rules text. It does not read the archetype claims in the Cube Cobra primer.

## Immediate Findings

1. **Blink means intentional exile-and-return only.** Copy, recursion, graveyard casting, and self-bounce are displayed as adjacent mechanics but are not counted as Blink enablers.
2. **The lowest-confidence Scryfall-derived lanes are ${weakest.map((x) => `${x.name} (${x.status}, ${x.score})`).join(', ')}.** These need either more redundant rewards or should remain overlap packages rather than advertised lanes.
3. **The best hidden lanes are ${strongestHidden.length ? strongestHidden.map((x) => `${x.name} (${x.enablers}/${x.payoffs})`).join(', ') : 'not yet dense enough to promote as standalone archetypes'}.** They are useful as overlap packages even when they should not become named guild themes.
4. **Enchantments are measured independently of the primer.** The current strict package is ${data.themes.find((x) => x.id === 'enchantments').status.toLowerCase()}, with ${data.themes.find((x) => x.id === 'enchantments').focusRoleCounts.enablers} GW-compatible enchantments and ${data.themes.find((x) => x.id === 'enchantments').focusRoleCounts.payoffs} GW-compatible explicit payoffs.
${blinkGaps.length ? `5. **Literal Blink access gaps remain in ${blinkGaps.map((x) => x.color).join(', ')}.** Adjacent copy, bounce, and recursion remain visible but do not fill those gaps.` : '5. **Every color has at least playable literal flicker access.** Preserve that balance when making cuts.'}

## Scryfall-Derived Themes

Score combines scaled density, payoff density, glue, enabler/payoff balance, and color accessibility. \`Support / 45\` is the expected number of theme-role cards in a random 45-card share of this ${data.cube.mainboardCount}-card cube; it is a comparison tool, not a draft guarantee.

| Theme | Best colors | Status | Score | Enablers | Payoffs | Glue | E:P | Support / 45 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows(data.themes, [['name'], ['bestColors', (value) => value.join('')], ['status'], ['score'], ['enablers'], ['payoffs'], ['glue'], ['enablerPayoffRatio'], ['supportPer45']])}

## Eight-Player Packet Visibility

This model shuffles the ${data.cube.mainboardCount}-card mainboard and deals eight non-overlapping 15-card packets (120 cards total). Percentages use exact hypergeometric probabilities. They measure opening-packet visibility only; they do not assume picks, passing, fixing, or successful deck construction.

| Archetype | Table signal | Expected E in 120 | Expected P in 120 | One packet has E | One packet has P | One packet has both | Expected coherent packets / 8 | Table sees both |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows(data.packModel, [['name'], ['tableReady'], ['table', (value) => value.expectedEnablers], ['table', (value) => value.expectedPayoffs], ['packet', (value) => `${value.enablerChance}%`], ['packet', (value) => `${value.payoffChance}%`], ['packet', (value) => `${value.bothChance}%`], ['expectedCoherentPackets'], ['table', (value) => `${value.bothChance}%`]])}

## Focus Lanes

- **UR Artifacts:** ${data.diagnostics.urArtifact.enablers.length} compatible enablers, ${data.diagnostics.urArtifact.payoffs.length} explicit payoffs, and ${data.diagnostics.urArtifact.glue.length} glue cards.
- **UR broad noncreature rewards:** ${data.diagnostics.noncreaturePayoffIds.length} cube-wide payoffs use broad noncreature wording.
- **Instant/sorcery-specific cards:** ${instantSorceryNames.length} cards explicitly mention instant and/or sorcery cards or spells; ${data.diagnostics.specificCastRewardIds.length} of those are the narrow cast rewards being considered for removal. Full list: ${instantSorceryNames.join(', ')}.
- **GW Enchantress:** ${data.diagnostics.gwEnchantress.enablers.length} compatible enchantments, ${data.diagnostics.gwEnchantress.payoffs.length} explicit payoffs, but only ${data.diagnostics.gwEnchantress.drawEngines.length} true draw engines. Sythis, Harvest's Hand is not currently in the cube and would be another true engine.

## 17Lands Powered Cube Evidence

The public 17Lands Powered Cube PremierDraft game dataset matches ${data.seventeenLands.coverage} of ${data.cube.mainboardCount} cards. The score is the card's GIH win-rate percentile among 544 cards with at least 250 games in hand. This is relevant cube evidence, but it is not a direct measurement of this custom ${data.cube.mainboardCount}-card environment.

Review candidates with a Powered Cube score at or below 20 and at least 500 games in hand:

${cutCandidates.map((card) => `- **${card.name}:** score ${card.seventeenLands.score}, grade ${card.seventeenLands.grade}, GIH WR ${(card.seventeenLands.gihWinRate * 100).toFixed(1)}%, IIH ${(card.seventeenLands.improvementInHand * 100).toFixed(1)} percentage points, average pick ${card.seventeenLands.avgPick}.`).join('\n')}

These are review flags, not automatic cuts. A low score may identify a narrow signpost that performs poorly without its package rather than a universally weak card.

## Standalone Card Quality

${data.summary.goodOnOwnCount} mainboard cards are currently marked as functional without a narrow synergy requirement. ${data.summary.combatSpeedCount} cards are instants or have flash; ${data.summary.highImpactCombatCount} of those are marked as high-impact combat options.

The card-level estimate keeps raw material separate from tempo. A one-for-one such as Swords to Plowshares is estimated at 0 raw card advantage even when its mana efficiency makes it excellent. A permanent that replaces itself, such as Wall of Omens, is about +1 material. Sweepers show their likely average separately from a best-case +4-or-more ceiling. These are transparent heuristics, not measured game results.

## Blink Coverage

| Color | Blink enablers | Adjacent copy | Adjacent recursion | Adjacent self-bounce | ETB hard payoffs | E:P | Coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows(data.blink, [['color'], ['enablers'], ['copy'], ['recursion'], ['selfBounce'], ['payoffs'], ['ratio'], ['coverage']])}

### Blink Reading

- White and blue should carry literal blink.
- Red's permanent-copy route is adjacent, not Blink.
- Black's reanimation and battlefield recursion route is a separate graveyard theme.
- Green's self-bounce/recast and creature recursion route is adjacent, not Blink.
- Colorless enablers are universal glue; they should not be counted as proof that a weak color is independently supported.

## Hidden And Adjacent Themes

| Theme | Signal | Best colors | Enablers | Payoffs | E:P |
|---|---:|---:|---:|---:|---:|
${rows(data.hiddenThemes, [['name'], ['signal'], ['bestColors'], ['enablers'], ['payoffs'], ['ratio']])}

\`Trap\` means the cube supplies many inputs but too few explicit rewards. Those cards can still be excellent glue; the warning is about advertising the package as a lane.

## Tribe Health

| Creature type | Bodies | Explicit Scryfall typal payoffs | Signal |
|---|---:|---:|---:|
${rows(data.tribes.slice(0, 40), [['type'], ['bodies'], ['payoffs'], ['signal']])}

Humans are the clear supported tribe. Other high body counts are mostly incidental unless their payoff column is also meaningful.

## Strongest Overlaps

| Theme A | Theme B | Shared cards | Smaller-package overlap |
|---|---|---:|---:|
${rows(data.overlaps.slice(0, 25), [['a'], ['b'], ['shared'], ['percent', (value) => `${value}%`]])}

## Tagging Policy

- **Local exhaustive layer:** every Scryfall oracle tag, every illustration tag, creature types, exact mana value, exact numeric power, \`power:4+\`, \`mv:4+\`, and derived ETB/enabler markers.
- **Live Cube Cobra layer:** concise draft roles such as \`Blink: Enabler\`, \`Blink: Payoff\`, \`Artifact Sac: Outlet\`, \`Artifact Sac: Fodder\`, \`Counters: Payoff\`, and \`Graveyard: Enabler\`.
- Existing personal tags outside these managed prefixes are preserved.
- The write tool verifies ownership, card IDs, board indexes, and cube version, creates a timestamped JSON/CSV backup, uses Cube Cobra's session-backed \`/cube/api/commit\` endpoint, and re-reads the cube to verify every applied tag set.

## Files

- \`dashboard.html\`: interactive health, blink, hidden-theme, tribe, card, and tag explorer.
- \`outputs/card-tag-map.csv\`: every card with all Scryfall and derived tags.
- \`outputs/scryfall-oracle-tag-frequency.csv\`: all oracle tags and counts.
- \`outputs/scryfall-art-tag-frequency.csv\`: all illustration tags and counts.
- \`outputs/theme-health.csv\`: Scryfall-derived theme metrics.
- \`outputs/pack-visibility.csv\`: exact 8-player, 15-card packet visibility math.
- \`outputs/card-quality.csv\`: every card's standalone tier, material estimate, speed, and best/average cases.
- \`outputs/17lands-card-scores.csv\`: Powered Cube GIH percentile, grade, pick timing, and cut-review flag for every cube card.
- \`outputs/instant-sorcery-specific-cards.csv\`: the exact narrow spellslinger list requested for review.
- \`outputs/blink-color-health.csv\`: per-color blink routes and gaps.
- \`outputs/proposed-live-tags.json\`: guarded input for the Cube Cobra writer.
`;
}

function strictReportMarkdown(data) {
  const rows = (items, render) => items.map((item) => `| ${render(item).join(' | ')} |`).join('\n');
  return `# ${data.cube.name} - Strict Cube Health Report

Generated: ${data.generatedAt}  
Cube Cobra version: ${data.cube.version}  
Mainboard: ${data.cube.mainboardCount} cards; maybeboard: ${data.cube.maybeboardCount}; recorded decks: ${data.cube.numDecks}

## Verdict

This is a structural synergy audit, not a win-rate claim. A strict role is assigned only when card type, a numeric characteristic, or oracle text proves it. An enabler contains or produces the theme input. A hard payoff requires a separate enabler. Glue is standalone-playable soft synergy. Scryfall tags nominate cards for review but never assign a theme by themselves.

The former permissive pass averaged 4.22 themes per card and put 917 cards in two or more themes. The strict pass averages **${data.overlapDistribution.averageThemesPerCard}** themes per mainboard card; **${data.overlapDistribution.multiThemeCards} cards (${data.overlapDistribution.multiThemePercent}%)** fit two or more, and **${data.overlapDistribution.threePlusCards} (${data.overlapDistribution.threePlusPercent}%)** fit three or more.

There are ${data.summary.rejectedScryfallNominations} Scryfall nominations in the review queue and ${data.summary.ambiguousPowerCards} variable-power creatures held out of numeric Power 4+ counts.

## Strict Themes

Theme names are single mechanical concepts. Attack Triggers and Combat Damage are separate; “saboteur” is not used as a user-facing category. Attack-trigger cards are enablers, while Isshin-style trigger doublers are hard payoffs. Glue never contributes to the health score.

| Theme | Best colors | Status | Score | Enablers | Hard payoffs | Glue / soft synergy | E:P | Support / 45 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows(data.themes, (theme) => [theme.name, theme.bestColors.join(''), theme.status, theme.score, theme.enablers, theme.payoffs, theme.glue, theme.enablerPayoffRatio, theme.supportPer45])}

## Guild Experiments

| Experiment | Colors | Enablers | Hard payoffs | Glue / soft synergy | Pack sees both | Eight packs see both | Reading |
|---|---:|---:|---:|---:|---:|---:|---|
${rows(data.guildExperiments, (experiment) => [
    experiment.name,
    experiment.colors.join(''),
    experiment.roleCardIds.enablers.length,
    experiment.roleCardIds.payoffs.length,
    experiment.roleCardIds.glue.length,
    `${experiment.visibility.packet.bothChance}%`,
    `${experiment.visibility.table.bothChance}%`,
    experiment.verdict,
  ])}

## Official RG Precedents

${data.research.precedents.map((item) => `- **${item.set}:** ${item.finding} (${item.url})`).join('\n')}

## Overlap Distribution

| Distinct strict themes | Cards | Mainboard share |
|---:|---:|---:|
${rows(data.overlapDistribution.buckets, (bucket) => [bucket.label, bucket.count, `${bucket.percent}%`])}

Overlap is descriptive, not a score to maximize. A card counts only when each assignment has separate mechanical evidence.

## Blink Coverage

Blink is intentionally narrow: only explicit exile-and-return effects are enablers. Copy, reanimation, graveyard casting, self-bounce, and landfall are separate. A hard payoff must be a nonland permanent that actual flicker demonstrably benefits: a reusable own enter/leave effect, re-preparing, a useful Saga reset, or relevant trigger amplification. Triggers caused only by opponent-controlled entries, land-enter triggers, and cast triggers do not qualify.

| Color | Blink enablers | Adjacent copy | Adjacent recursion | Adjacent self-bounce | ETB hard payoffs | E:P | Coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows(data.blink, (item) => [item.color, item.enablers, item.copy, item.recursion, item.selfBounce, item.payoffs, item.ratio, item.coverage])}

## Card-Type and Function Census

- Creatures: ${data.typeCounts.Creature}; instants: ${data.typeCounts.Instant}; sorceries: ${data.typeCounts.Sorcery}; artifacts: ${data.typeCounts.Artifact}.
- Interaction: ${data.functionCounts.Interaction}; Value: ${data.functionCounts.Value}. Functional labels intentionally overlap.
- Cube-specific sharpie text is authoritative for Agent of the Iron Throne, Arcane Signet, and Path of Ancestry; printed text remains visible beside it in the dashboard.
- Every card on all three boards has ${data.summary.strictThemeCount * 3} assigned/unassigned role decisions in \`outputs/card-taxonomy-audit.jsonl\`; multi-face and rejected-nomination notes remain explicit.

## New-Card Findings (v${data.changes.fromVersion} to v${data.changes.toVersion})

These ${data.newCardFindings.length} additions are audited against the same rules as the rest of the cube. “No strict role” is an explicit result, not an omitted review.

${data.newCardFindings.map((item) => `- **${item.name}** (${item.type || 'type unavailable'}): ${item.roles.length ? item.roles.map((role) => `${role.archetype} — ${role.role}`).join('; ') : 'No strict role'}.${item.adjacentMechanics.length ? ` Adjacent only: ${item.adjacentMechanics.map((role) => role.label).join(', ')}.` : ''}${item.uncertainties.length ? ` Notes: ${item.uncertainties.join(' ')}` : ''}`).join('\n')}

## Weak-Card Review

This is a multi-signal review, not an automatic cut list. ${data.weaknessSummary.localPickEvidence} ${data.weaknessSummary.communityHistoryRule}

- Likely cuts: ${data.weaknessSummary.likelyCuts}
- Needs review: ${data.weaknessSummary.review}
- No strict archetype home: ${data.weaknessSummary.noStrictHome}
- Low modeled standalone impact: ${data.weaknessSummary.lowImpact}
- Low mature-card community demand: ${data.weaknessSummary.lowCommunityDemand}
- 17Lands Powered Cube underperformers: ${data.weaknessSummary.poweredUnderperformers}

| Card | Tier | Score | Negative signals | Main reasons |
|---|---:|---:|---:|---|
${rows(data.weakCards.filter((item) => item.weakness.reviewTier === 'Likely cut'), (item) => [item.name, item.weakness.reviewTier, item.weakness.reviewScore, item.weakness.negativeSignals, item.weakness.reasons.map((reason) => reason.label).join('; ')])}

## Review Queues

- Rejected Scryfall nominations: ${data.diagnostics.rejectedNominations.length}
- Variable-power creatures excluded from numeric Power 4+ counts: ${data.diagnostics.ambiguousPowerIds.length}
- Every accepted role records a rule ID and a concrete reason.

## Tagging Policy

- Local exhaustive layer: all Scryfall oracle tags, art tags, types, mana values, and numeric powers remain searchable.
- Strict classification layer: one mechanical concept per theme, proven without relying on Scryfall tags, using the enabler / hard-payoff / soft-synergy contract above.
- Live Cube Cobra layer: generated strict role and functional tags are gated by strict-v2 semantic verification against the same cube version.
- Existing personal tags outside the managed prefixes are preserved.

## Files

- \`dashboard.html\`: strict themes, guild experiments, overlap, and review queues.
- \`outputs/card-tag-map.csv\`: every card with role evidence and exhaustive local tags.
- \`outputs/card-taxonomy-audit.jsonl\` and \`outputs/taxonomy-audit-packets/\`: durable per-card Oracle, face, metadata, adjacent-mechanic, and assigned/unassigned role evidence for every board.
- \`outputs/strict-overlap.csv\`: strict theme-count percentage for every mainboard card.
- \`outputs/guild-experiments.csv\`: RG, UG, and GW experiment densities and packet visibility.
- \`outputs/weak-card-review.csv\`: every nonland plus any format-inactive land, ranked with negative evidence, protections, recency handling, and local-pick limits.
- \`outputs/rejected-scryfall-nominations.csv\`: discovery tags that failed strict classification.
- \`outputs/proposed-live-tags.json\`: guarded input for the Cube Cobra writer; not an applied edit.
`;
}

async function main() {
  if (process.argv.includes('--fetch')) await refreshRawData();
  const raw = JSON.parse(await fs.readFile(path.join(rawDir, 'cube.json'), 'utf8'));
  const seventeenLandsRaw = await readJsonIfExists(seventeenLandsPath, { source: null, ratings: [] });
  const researchRaw = await readJsonIfExists(researchPath, { source: null, searches: [] });
  const cubeAdjacency = await readJsonIfExists(path.join(root, 'data', 'cubecobra-ml', 'cubecobra-adjacency.json'), null);
  const seventeenLandsByName = new Map(seventeenLandsRaw.ratings.map((rating) => [rating.normalizedName ?? normalizeName(rating.name), rating]));
  const boards = ['mainboard', 'maybeboard', 'basics'];
  const cards = boards.flatMap((board) => (raw.cards?.[board] ?? []).map((entry) => normalizeCard(entry, board)));
  const mainboard = cards.filter((card) => card.board === 'mainboard');
  if (mainboard.length !== raw.cardCount) throw new Error(`Cube card count mismatch: metadata=${raw.cardCount}, mainboard=${mainboard.length}`);

  const formatText = `${JSON.stringify(raw.formats ?? [])}\n${raw.description ?? ''}`;
  const cubeUsesCommanders = /commander draft|command zone|designat(?:e|es|ed|ing) [^.\n]{0,40}commander/i.test(formatText);

  for (const card of cards) {
    card.inactiveInCubeFormat = !cubeUsesCommanders && taxonomyHelpers.isCommanderOnly(card);
    card.functionRoles = functionalRoleMatches(card);
    card.proposedTags = proposedTagsFor(card);
    card.localTags = derivedLocalTags(card);
    card.seventeenLands = seventeenLandsByName.get(normalizeName(card.name)) ?? null;
  }

  const qualityByCard = classifyCardQuality(cards);
  for (const card of cards) card.quality = qualityByCard.get(`${card.board}:${card.index}`);

  const themes = classifyThemes(mainboard);
  const archetypeRolesByCard = new Map();
  for (const card of cards) {
    const id = `${card.board}:${card.index}`;
    const roles = [];
    for (const theme of STRICT_THEMES) {
      for (const match of strictRoleMatches(theme, card)) {
        roles.push({ archetypeId: theme.id, archetype: theme.name, role: match.role, ruleId: match.ruleId, reason: match.reason });
      }
    }
    archetypeRolesByCard.set(id, roles);
  }
  const mainboardById = new Map(mainboard.map((card) => [`${card.board}:${card.index}`, card]));
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));
  const roleIds = (themeId, role) => themeById.get(themeId)?.roleCardIds?.[role] ?? [];
  const focusRoleIds = (themeId, role, colors) => roleIds(themeId, role).filter((id) => playableIn(mainboardById.get(id), colors));

  const instantSorcerySpecificIds = mainboard.filter(taxonomyHelpers.mentionsInstantSorcery).map((card) => `${card.board}:${card.index}`);
  const noncreaturePayoffIds = roleIds('noncreature-spells', 'payoffs');
  const specificCastRewardIds = instantSorcerySpecificIds.filter((id) => /whenever you cast an instant or sorcery spell|number of instant and sorcery spells you(?:'|’)ve cast|next instant or sorcery spell you cast/i.test(mainboardById.get(id).oracleText));
  const broadNoncreatureOnlyIds = noncreaturePayoffIds.filter((id) => !instantSorcerySpecificIds.includes(id));
  const urArtifact = {
    enablers: focusRoleIds('artifacts', 'enablers', ['U', 'R']),
    payoffs: focusRoleIds('artifacts', 'payoffs', ['U', 'R']),
    glue: focusRoleIds('artifacts', 'glue', ['U', 'R']),
  };
  const gwEnchantress = {
    enablers: focusRoleIds('enchantments', 'enablers', ['W', 'G']),
    payoffs: focusRoleIds('enchantments', 'payoffs', ['W', 'G']),
    glue: focusRoleIds('enchantments', 'glue', ['W', 'G']),
    drawEngines: focusRoleIds('enchantments', 'payoffs', ['W', 'G']).filter((id) =>
      mainboardById
        .get(id)
        .oracleText.split('\n')
        .some((paragraph) => /whenever[^.\n]*(?:cast[^.\n]*enchantment|enchantment[^.\n]*enters)[^.\n]*draw a card/i.test(paragraph)),
    ),
  };

  const themeCounts = mainboard.map((card) => {
    const id = `${card.board}:${card.index}`;
    const count = new Set((archetypeRolesByCard.get(id) ?? []).map((role) => role.archetypeId)).size;
    return { id, name: card.name, count, percentOfThemes: round((count * 100) / themes.length, 1) };
  });
  const themeCountById = new Map(themeCounts.map((item) => [item.id, item.count]));
  const allBoardThemeCounts = new Map(cards.map((card) => {
    const id = `${card.board}:${card.index}`;
    const count = new Set((archetypeRolesByCard.get(id) ?? []).map((role) => role.archetypeId)).size;
    return [id, { count, percent: round((count * 100) / themes.length, 1) }];
  }));
  const nonlandMainboard = mainboard.filter((card) => !card.isLand);
  const reviewableMainboard = mainboard.filter((card) => !card.isLand || card.inactiveInCubeFormat);
  const matureBeforeYear = new Date().getUTCFullYear() - 2;
  const matureCards = nonlandMainboard.filter((card) => card.firstPrintYear > 0 && card.firstPrintYear < matureBeforeYear);
  const pickPercentile = percentileRanker(matureCards.map((card) => card.pickCount));
  const cubeCountPercentile = percentileRanker(matureCards.map((card) => card.cubeCount));
  const eloPercentile = percentileRanker(nonlandMainboard.map((card) => card.elo));
  const weaknessByCard = new Map(reviewableMainboard.map((card) => {
    const id = `${card.board}:${card.index}`;
    const roles = archetypeRolesByCard.get(id) ?? [];
    const meaningfulRoles = roles.filter((role) => role.ruleId !== 'noncreature-input');
    const distinctThemes = new Set(meaningfulRoles.map((role) => role.archetypeId)).size;
    const hasPayoffRole = meaningfulRoles.some((role) => role.role === 'payoffs');
    const communityHistoryMature = !card.isLand && card.firstPrintYear > 0 && card.firstPrintYear < matureBeforeYear;
    const communityPickVolumePercentile = communityHistoryMature ? pickPercentile(card.pickCount) : null;
    const communityCubeCountPercentile = communityHistoryMature ? cubeCountPercentile(card.cubeCount) : null;
    const communityEloPercentile = card.isLand ? null : eloPercentile(card.elo);
    const communityDemandPercentile = communityHistoryMature
      ? round((communityPickVolumePercentile + communityCubeCountPercentile) / 2, 1)
      : null;
    const poweredUnderperformer = Boolean(
      card.seventeenLands
      && card.seventeenLands.score <= 20
      && card.seventeenLands.gamesInHand >= 500,
    );
    const poweredStrong = Boolean(
      card.seventeenLands
      && card.seventeenLands.score >= 60
      && card.seventeenLands.gamesInHand >= 500,
    );
    const lowImpact = !card.quality.mechanicalGoodOnOwn
      && card.quality.mechanicalScore < 44
      && card.quality.averageAdvantage <= 0
      && card.quality.bestAdvantage <= 1
      && card.quality.combatEffectiveness === 'None';
    const noStrictHome = distinctThemes === 0;
    const narrowAndDependent = distinctThemes <= 1 && card.quality.synergyNeed !== 'Low';
    const inactiveInCubeFormat = card.inactiveInCubeFormat;
    const userRequestedRemoval = userRequestedRemovalNames.has(normalizeName(card.name));
    const reasons = [];
    const protections = [];
    let reviewScore = 0;

    if (inactiveInCubeFormat) {
      reviewScore += 70;
      reasons.push({ id: 'inactive-format', label: 'Inactive without a commander', evidence: 'The cube has no Commander draft or command-zone rule, and every functional ability on this card depends on a commander.' });
    }
    if (userRequestedRemoval) {
      reviewScore += 100;
      reasons.push({ id: 'user-removal', label: 'Owner-requested cut', evidence: 'Named for removal with the retired GW Enchantress package.' });
    }
    if (noStrictHome) {
      reviewScore += 24;
      reasons.push({ id: 'no-strict-home', label: 'No meaningful strict archetype home', evidence: 'No mechanically specific enabler, payoff, or glue role; the universal Noncreature Spell input role does not count as a home.' });
    }
    if (!hasPayoffRole) {
      reasons.push({ id: 'no-payoff-home', label: 'No payoff role', evidence: 'The card does not explicitly reward any currently modeled theme.' });
    }
    if (lowImpact) {
      reviewScore += 22;
      reasons.push({ id: 'low-impact', label: 'Low modeled standalone impact', evidence: `ELO-neutral mechanical quality ${card.quality.mechanicalScore}; average card advantage ${card.quality.advantageLabel}; no combat-speed impact.` });
    }
    if (communityHistoryMature && communityEloPercentile !== null && communityEloPercentile <= 20) {
      reviewScore += 15;
      reasons.push({ id: 'low-community-elo', label: 'Low CubeCobra ELO', evidence: `Community ELO ${Math.round(card.elo)} is at the ${communityEloPercentile}th percentile of this cube's nonlands.` });
    }
    if (communityHistoryMature && communityPickVolumePercentile !== null && communityCubeCountPercentile !== null && communityPickVolumePercentile <= 20 && communityCubeCountPercentile <= 20) {
      reviewScore += 12;
      reasons.push({ id: 'low-community-demand', label: 'Low CubeCobra demand', evidence: `${card.pickCount.toLocaleString()} community picks (${communityPickVolumePercentile}th percentile) and ${card.cubeCount.toLocaleString()} cubes (${communityCubeCountPercentile}th percentile) among pre-${matureBeforeYear} cards.` });
    }
    if (poweredUnderperformer) {
      reviewScore += 22;
      reasons.push({ id: 'powered-underperformer', label: 'Powered Cube underperformer', evidence: `17Lands score ${card.seventeenLands.score}/100 over ${card.seventeenLands.gamesInHand.toLocaleString()} games in hand.` });
    }
    if (narrowAndDependent) {
      reviewScore += 8;
      reasons.push({ id: 'narrow-dependent', label: 'Narrow fit', evidence: `${distinctThemes} strict theme${distinctThemes === 1 ? '' : 's'} and ${card.quality.synergyNeed.toLowerCase()} modeled synergy need.` });
    }

    if (card.quality.goodOnOwn || card.quality.score >= 68) {
      reviewScore -= 22;
      protections.push({ id: 'strong-standalone', label: 'Strong standalone floor', evidence: `Quality ${card.quality.score}; good-on-own=${card.quality.goodOnOwn}.` });
    }
    if (communityEloPercentile !== null && communityEloPercentile >= 70) {
      reviewScore -= 15;
      protections.push({ id: 'high-community-elo', label: 'High CubeCobra ELO', evidence: `${communityEloPercentile}th percentile of this cube's nonlands.` });
    }
    if (communityDemandPercentile !== null && communityDemandPercentile >= 70) {
      reviewScore -= 20;
      protections.push({ id: 'high-community-demand', label: 'High CubeCobra demand', evidence: `${card.pickCount.toLocaleString()} community picks and ${card.cubeCount.toLocaleString()} cubes average to the ${communityDemandPercentile}th demand percentile.` });
    }
    if (poweredStrong) {
      reviewScore -= 18;
      protections.push({ id: 'powered-strong', label: 'Strong Powered Cube result', evidence: `17Lands score ${card.seventeenLands.score}/100 over ${card.seventeenLands.gamesInHand.toLocaleString()} games in hand.` });
    }
    if (distinctThemes >= 3) {
      reviewScore -= 8;
      protections.push({ id: 'multi-theme', label: 'Flexible archetype bridge', evidence: `Fits ${distinctThemes} distinct strict themes.` });
    }

    reviewScore = Math.max(0, Math.min(100, reviewScore));
    const negativeSignals = reasons.filter((reason) => reason.id !== 'no-payoff-home').length;
    const reviewTier = userRequestedRemoval || inactiveInCubeFormat || (reviewScore >= 55 && negativeSignals >= 3 && protections.length <= 1)
      ? 'Likely cut'
      : reviewScore >= 35 && negativeSignals >= 2
        ? 'Review'
        : reviewScore >= 20
          ? 'Watch'
          : 'Protected';
    return [id, {
      reviewScore,
      reviewTier,
      negativeSignals,
      reasons,
      protections,
      noStrictHome,
      hasPayoffRole,
      meaningfulThemeCount: distinctThemes,
      lowImpact,
      poweredUnderperformer,
      userRequestedRemoval,
      inactiveInCubeFormat,
      communityHistoryMature,
      communityPickVolumePercentile,
      communityCubeCountPercentile,
      communityDemandPercentile,
      communityEloPercentile,
      localPickEvidence: raw.numDecks >= 20
        ? `${raw.numDecks} CubeCobra decks are available for local pick review.`
        : `Only ${raw.numDecks ?? 0} CubeCobra decks are recorded; local "never picked" claims are not supported.`,
    }];
  }));
  const weakCards = reviewableMainboard
    .map((card) => ({ id: `${card.board}:${card.index}`, name: card.name, colors: card.colors, weakness: weaknessByCard.get(`${card.board}:${card.index}`) }))
    .sort((a, b) => b.weakness.reviewScore - a.weakness.reviewScore || a.name.localeCompare(b.name));
  const appliedOwnerCuts = userRequestedRemovals
    .filter((name) => !mainboard.some((card) => normalizeName(card.name) === normalizeName(name)));
  const weaknessSummary = {
    cardsReviewed: weakCards.length,
    likelyCuts: weakCards.filter((card) => card.weakness.reviewTier === 'Likely cut').length,
    review: weakCards.filter((card) => card.weakness.reviewTier === 'Review').length,
    watch: weakCards.filter((card) => card.weakness.reviewTier === 'Watch').length,
    protected: weakCards.filter((card) => card.weakness.reviewTier === 'Protected').length,
    noStrictHome: weakCards.filter((card) => card.weakness.noStrictHome).length,
    lowImpact: weakCards.filter((card) => card.weakness.lowImpact).length,
    lowCommunityDemand: weakCards.filter((card) => card.weakness.reasons.some((reason) => reason.id === 'low-community-demand')).length,
    poweredUnderperformers: weakCards.filter((card) => card.weakness.poweredUnderperformer).length,
    userRequestedCuts: weakCards.filter((card) => card.weakness.userRequestedRemoval).length,
    inactiveInCubeFormat: weakCards.filter((card) => card.weakness.inactiveInCubeFormat).length,
    localPickEvidence: raw.numDecks >= 20
      ? `${raw.numDecks} CubeCobra decks are available for local pick review.`
      : `Only ${raw.numDecks ?? 0} CubeCobra decks are recorded, so this audit does not claim that any card is literally never picked in this cube.`,
    communityHistoryRule: `Low community demand is applied only to cards first printed before ${matureBeforeYear}; newer cards are marked as insufficient history instead of penalized.`,
  };
  const buckets = [0, 1, 2, 3].map((count) => ({
    label: String(count),
    count: themeCounts.filter((item) => item.count === count).length,
  }));
  buckets.push({ label: '4+', count: themeCounts.filter((item) => item.count >= 4).length });
  const overlapDistribution = {
    themeCount: themes.length,
    averageThemesPerCard: round(themeCounts.reduce((sum, item) => sum + item.count, 0) / mainboard.length),
    multiThemeCards: themeCounts.filter((item) => item.count >= 2).length,
    multiThemePercent: round((themeCounts.filter((item) => item.count >= 2).length * 100) / mainboard.length, 1),
    threePlusCards: themeCounts.filter((item) => item.count >= 3).length,
    threePlusPercent: round((themeCounts.filter((item) => item.count >= 3).length * 100) / mainboard.length, 1),
    buckets: buckets.map((bucket) => ({ ...bucket, percent: round((bucket.count * 100) / mainboard.length, 1) })),
    mostFlexible: [...themeCounts].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 80),
  };

  const makeExperiment = (id, name, themeId, colors, verdict) => {
    const roleCardIds = Object.fromEntries(['enablers', 'payoffs', 'glue'].map((role) => [role, focusRoleIds(themeId, role, colors)]));
    const supportIds = [...new Set(Object.values(roleCardIds).flat())];
    const roleColorContributions = Object.fromEntries(['enablers', 'payoffs', 'glue'].map((role) => [role, Object.fromEntries(
      [...colors, 'C'].map((color) => [color, roleCardIds[role].filter((cardId) => {
        const card = mainboardById.get(cardId);
        return color === 'C' ? card.colors.length === 0 : card.colors.includes(color);
      }).length]),
    )]));
    const visibility = packVisibility([{ id, name, roleCardIds }], mainboard.length, 8, 15)[0];
    const flexibleCards = supportIds
      .map((cardId) => {
        const card = mainboardById.get(cardId);
        const roles = archetypeRolesByCard.get(cardId) ?? [];
        const strictThemes = [...new Set(roles.map((role) => role.archetype))];
        return { id: cardId, name: card.name, themeCount: strictThemes.length, percentOfThemes: round((strictThemes.length * 100) / themes.length, 1), themes: strictThemes };
      })
      .filter((card) => card.themeCount >= 2)
      .sort((a, b) => b.themeCount - a.themeCount || a.name.localeCompare(b.name));
    return {
      id,
      name,
      themeId,
      colors,
      verdict,
      balanceGoalMet: roleCardIds.enablers.length > roleCardIds.payoffs.length,
      roleCardIds,
      roleColorContributions,
      supportIds,
      visibility,
      flexibleCards,
    };
  };
  const guildExperiments = [
    makeExperiment('rg-power-four', 'RG Power 4+', 'power-four', ['R', 'G'], 'Coherent now; red and multicolor threshold rewards are the main research need.'),
    makeExperiment('rg-power-matters', 'RG Power Matters', 'power-matters', ['R', 'G'], 'Coherent and distinct from the 4+ threshold: effects scale from power rather than merely checking it.'),
    makeExperiment('ug-counters', 'UG +1/+1 Counters', 'pp-counters', ['U', 'G'], 'Coherent but payoff-light; blue contributes proliferate and counter-linked card advantage.'),
    makeExperiment('ug-landfall', 'UG Landfall', 'landfall', ['U', 'G'], 'Mechanically clear but currently green-heavy; treat as an experiment until blue or UG rewards are added.'),
    makeExperiment('gw-counters', 'GW +1/+1 Counters', 'pp-counters', ['W', 'G'], 'Coherent comparison lane; white supplies more counter makers, while UG currently has one more strict payoff and one more off-green payoff.'),
  ];

  const matched17Lands = mainboard.filter((card) => card.seventeenLands?.score !== null && card.seventeenLands?.score !== undefined);
  const cutCandidateIds = matched17Lands
    .filter((card) => !card.isLand && card.seventeenLands.score <= 20 && card.seventeenLands.gamesInHand >= 500)
    .sort((a, b) => a.seventeenLands.score - b.seventeenLands.score || a.seventeenLands.improvementInHand - b.seventeenLands.improvementInHand)
    .slice(0, 40)
    .map((card) => `${card.board}:${card.index}`);

  const cubeNames = new Set(mainboard.map((card) => normalizeName(card.name)));
  const researchGroups = researchRaw.searches.map((search) => {
    const candidates = search.cards
      .filter((card) => !cubeNames.has(normalizeName(card.name)))
      .map((card) => ({ ...card, seventeenLands: seventeenLandsByName.get(normalizeName(card.name)) ?? null }))
      .sort((a, b) => {
        if (a.name === "Sythis, Harvest's Hand") return -1;
        if (b.name === "Sythis, Harvest's Hand") return 1;
        return (b.seventeenLands?.score ?? -1) - (a.seventeenLands?.score ?? -1) || (a.edhrecRank ?? Number.MAX_SAFE_INTEGER) - (b.edhrecRank ?? Number.MAX_SAFE_INTEGER);
      })
      .slice(0, 18);
    return { id: search.id, label: search.label, query: search.query, candidates };
  });

  const signpostNames = ['Ephemerate', 'Weapons Manufacturing', 'Vivi Ornitier', "Sythis, Harvest's Hand"];
  const signposts = signpostNames.map((name) => {
    const copies = mainboard.filter((card) => normalizeName(card.name) === normalizeName(name));
    const candidate = researchGroups.flatMap((group) => group.candidates).find((card) => normalizeName(card.name) === normalizeName(name));
    const rating = seventeenLandsByName.get(normalizeName(name)) ?? null;
    return {
      name,
      present: copies.length > 0,
      cardId: copies.length ? `${copies[0].board}:${copies[0].index}` : null,
      image: copies[0]?.image ?? candidate?.image ?? '',
      currentCopies: copies.length,
      currentTableChance: chanceAtLeastOne(mainboard.length, copies.length, 120),
      tableChanceByCopies: [1, 2, 3, 4, 6, 8, 12].map((count) => ({ copies: count, chance: chanceAtLeastOne(mainboard.length, count, 120) })),
      rating,
      note: copies.length ? 'Present in the current mainboard.' : 'Not present in the current mainboard.',
    };
  });

  const previousRaw = await readJsonIfExists(path.join(rawDir, 'previous-cube.json'), null);
  const changes = { fromVersion: previousRaw?.version ?? null, toVersion: raw.version, added: [], removed: [] };
  if (previousRaw) {
    const tally = (entries) => {
      const counts = new Map();
      for (const entry of entries) {
        const key = `${entry.cardID}|${entry.details?.name ?? entry.cardID}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return counts;
    };
    const before = tally(previousRaw.cards?.mainboard ?? []);
    const after = tally(raw.cards?.mainboard ?? []);
    for (const [key, count] of after) if (count > (before.get(key) ?? 0)) changes.added.push({ name: key.split('|').slice(1).join('|'), count: count - (before.get(key) ?? 0), cardId: mainboard.find((card) => card.cardID === key.split('|')[0]) ? `${mainboard.find((card) => card.cardID === key.split('|')[0]).board}:${mainboard.find((card) => card.cardID === key.split('|')[0]).index}` : null });
    for (const [key, count] of before) if (count > (after.get(key) ?? 0)) changes.removed.push({ name: key.split('|').slice(1).join('|'), count: count - (after.get(key) ?? 0) });
  } else if (raw.version === V555_CHANGES.toVersion) {
    changes.fromVersion = V555_CHANGES.fromVersion;
    changes.added = V555_CHANGES.added.map((name) => {
      const card = mainboard.find((candidate) => candidate.name === name);
      return { name, count: 1, cardId: card ? `${card.board}:${card.index}` : null };
    });
    changes.removed = V555_CHANGES.removed.map((name) => ({ name, count: 1 }));
  }
  const hiddenThemes = themes
    .filter((theme) => theme.score < 65)
    .map((theme) => ({
      id: theme.id,
      name: theme.name,
      enablers: theme.enablers,
      payoffs: theme.payoffs,
      ratio: theme.enablerPayoffRatio,
      signal: theme.status,
      bestColors: theme.bestColors.join(''),
      bestColorEnablers: theme.focusRoleCounts.enablers,
      bestColorPayoffs: theme.focusRoleCounts.payoffs,
      examples: [...theme.roleCards.payoffs, ...theme.roleCards.enablers].slice(0, 5),
    }));
  const blink = blinkByColor(mainboard);
  const tribes = tribeCensus(mainboard);
  const overlaps = computeOverlaps(themes);
  const oracleTagFrequency = frequency(mainboard, 'oracleTags');
  const artTagFrequency = frequency(mainboard, 'artTags');
  const proposedLiveTags = [...new Set(cards.flatMap((card) => card.proposedTags))].sort();
  const packModel = packVisibility(themes, mainboard.length, 8, 15);
  const generatedAt = new Date().toISOString();
  const typeNames = ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Battle'];
  const typeCounts = Object.fromEntries(typeNames.map((type) => [type, mainboard.filter((card) => new RegExp(`\\b${type}\\b`, 'i').test(card.type)).length]));
  typeCounts['Instant or Sorcery'] = mainboard.filter((card) => /\b(?:Instant|Sorcery)\b/i.test(card.type)).length;
  const functionCounts = Object.fromEntries(['Interaction', 'Value'].map((label) => [label, mainboard.filter((card) => card.functionRoles.some((role) => role.label === label)).length]));
  const taxonomyAudit = buildTaxonomyAudit(cards);
  const taxonomyAuditById = new Map(taxonomyAudit.map((entry) => [entry.id, entry]));
  const newCardFindings = changes.added.map((change) => {
    const card = mainboardById.get(change.cardId);
    const audit = taxonomyAuditById.get(change.cardId);
    return {
      ...change,
      oracleText: card?.oracleText ?? '',
      type: card?.type ?? '',
      layout: card?.layout ?? '',
      roles: archetypeRolesByCard.get(change.cardId) ?? [],
      adjacentMechanics: card ? taxonomyHelpers.adjacentMechanicMatches(card) : [],
      auditStatus: audit?.status ?? 'missing',
      uncertainties: audit?.uncertainties ?? ['Card was named in the v555 change packet but was not found in the current mainboard.'],
    };
  });

  const data = {
    generatedAt,
    cube: {
      id: raw.id,
      shortId: raw.shortId,
      name: raw.name.trim(),
      owner: raw.owner?.username,
      version: raw.version,
      updatedAt: new Date(raw.dateLastUpdated).toISOString(),
      mainboardCount: mainboard.length,
      maybeboardCount: cards.filter((card) => card.board === 'maybeboard').length,
      basicsCount: cards.filter((card) => card.board === 'basics').length,
      numDecks: raw.numDecks ?? 0,
      primerHasEnchantress: /\{W\}\{G\}\s+Enchantress/i.test(raw.description ?? ''),
      primerHasGrowth: /\{W\}\{G\}\s+\+1\/\+1 Counters & Go Wide/i.test(raw.description ?? ''),
    },
    summary: {
      oracleTagCount: oracleTagFrequency.length,
      oracleTagAssignments: mainboard.reduce((sum, card) => sum + card.oracleTags.length, 0),
      artTagCount: artTagFrequency.length,
      artTagAssignments: mainboard.reduce((sum, card) => sum + card.artTags.length, 0),
      proposedLiveTagCount: proposedLiveTags.length,
      proposedLiveTagAssignments: cards.reduce((sum, card) => sum + card.proposedTags.length, 0),
      goodOnOwnCount: mainboard.filter((card) => card.quality.goodOnOwn).length,
      combatSpeedCount: mainboard.filter((card) => card.quality.combatSpeed).length,
      highImpactCombatCount: mainboard.filter((card) => card.quality.combatEffectiveness === 'High').length,
      seventeenLandsCoverage: matched17Lands.length,
      seventeenLandsCutCandidates: cutCandidateIds.length,
      likelyCutCount: weaknessSummary.likelyCuts,
      cutReviewCount: weaknessSummary.review,
      strictThemeCount: themes.length,
      averageStrictThemesPerCard: overlapDistribution.averageThemesPerCard,
      multiThemePercent: overlapDistribution.multiThemePercent,
      rejectedScryfallNominations: themes.reduce((sum, theme) => sum + theme.rejectedNominations.length, 0),
      ambiguousPowerCards: mainboard.filter(taxonomyHelpers.hasAmbiguousPower).length,
      auditedCards: taxonomyAudit.length,
      auditedRoleDecisions: taxonomyAudit.reduce((sum, entry) => sum + entry.themes.reduce((themeSum, theme) => themeSum + theme.roles.length, 0), 0),
      cardsWithAuditNotes: taxonomyAudit.filter((entry) => entry.uncertainties.length).length,
    },
    typeCounts,
    functionCounts,
    themes,
    hiddenThemes,
    blink,
    tribes,
    overlaps,
    packModel,
    overlapDistribution,
    guildExperiments,
    weakCards,
    weaknessSummary,
    appliedOwnerCuts,
    diagnostics: {
      instantSorcerySpecificIds,
      specificCastRewardIds,
      noncreaturePayoffIds,
      broadNoncreatureOnlyIds,
      urArtifact,
      gwEnchantress,
      ambiguousPowerIds: mainboard.filter(taxonomyHelpers.hasAmbiguousPower).map((card) => `${card.board}:${card.index}`),
      rejectedNominations: themes.flatMap((theme) => theme.rejectedNominations.map((item) => ({ themeId: theme.id, theme: theme.name, ...item }))),
    },
    seventeenLands: {
      source: seventeenLandsRaw.source,
      coverage: matched17Lands.length,
      cutCandidateIds,
      signposts,
    },
    research: { source: researchRaw.source, precedents: researchRaw.precedents ?? [], groups: researchGroups },
    cubeAdjacency,
    changes,
    newCardFindings,
    oracleTagFrequency,
    artTagFrequency,
    cards: cards.map((card) => ({
      id: `${card.board}:${card.index}`,
      board: card.board,
      index: card.index,
      cardID: card.cardID,
      oracleId: card.oracleId,
      name: card.name,
      colors: card.colors,
      colorLabel: card.colorLabel,
      cmc: card.cmc,
      type: card.type,
      layout: card.layout,
      faceCount: card.faceCount,
      imageFlip: card.imageFlip,
      producedMana: card.producedMana,
      image: card.image,
      scryfallUri: card.scryfallUri,
      oracleText: card.oracleText,
      printedOracleText: card.printedOracleText,
      cubeOracleText: card.cubeOracleText,
      hasCubeOverride: card.hasCubeOverride,
      keywords: card.keywords,
      power: card.power,
      toughness: card.toughness,
      elo: card.elo,
      pickCount: card.pickCount,
      popularity: card.popularity,
      cubeCount: card.cubeCount,
      releasedAt: card.releasedAt,
      firstPrintYear: card.firstPrintYear,
      inactiveInCubeFormat: card.inactiveInCubeFormat,
      oracleTags: card.oracleTags,
      artTags: card.artTags,
      creatureTypes: card.creatureTypes,
      proposedTags: card.proposedTags,
      localTags: card.localTags,
      adjacentMechanics: taxonomyHelpers.adjacentMechanicMatches(card),
      taxonomyAuditStatus: taxonomyAuditById.get(`${card.board}:${card.index}`).status,
      taxonomyAuditNotes: taxonomyAuditById.get(`${card.board}:${card.index}`).uncertainties,
      functionRoles: card.functionRoles,
      archetypeRoles: archetypeRolesByCard.get(`${card.board}:${card.index}`) ?? [],
      strictThemeCount: allBoardThemeCounts.get(`${card.board}:${card.index}`).count,
      strictThemePercent: allBoardThemeCounts.get(`${card.board}:${card.index}`).percent,
      quality: card.quality,
      weakness: weaknessByCard.get(`${card.board}:${card.index}`) ?? null,
      seventeenLands: card.seventeenLands,
      search: [card.name, card.type, card.oracleText, card.printedOracleText, card.colorLabel, ...card.oracleTags, ...card.artTags, ...card.creatureTypes, ...card.proposedTags, ...card.localTags, ...card.functionRoles.flatMap((role) => [role.label, role.reason]), ...(archetypeRolesByCard.get(`${card.board}:${card.index}`) ?? []).flatMap((role) => [role.archetype, role.role])].join(' ').toLowerCase(),
    })),
  };

  await Promise.all([fs.mkdir(outputDir, { recursive: true }), fs.mkdir(reportDir, { recursive: true })]);
  const auditPacketDir = path.join(outputDir, 'taxonomy-audit-packets');
  await fs.mkdir(auditPacketDir, { recursive: true });
  const auditPackets = [];
  for (let start = 0; start < taxonomyAudit.length; start += 100) {
    const packet = taxonomyAudit.slice(start, start + 100);
    auditPackets.push(fs.writeFile(
      path.join(auditPacketDir, `cards-${String(start + 1).padStart(4, '0')}-${String(start + packet.length).padStart(4, '0')}.json`),
      `${JSON.stringify(packet, null, 2)}\n`,
    ));
  }
  const cardRows = cards.map((card) => ({
    board: card.board,
    index: card.index,
    name: card.name,
    color_identity: card.colorLabel,
    mana_value: card.cmc,
    type: card.type,
    cube_rules_text: card.cubeOracleText,
    printed_rules_text: card.printedOracleText,
    power: card.power,
    toughness: card.toughness,
    creature_types: card.creatureTypes,
    proposed_cube_cobra_tags: card.proposedTags,
    function_labels: card.functionRoles.map((role) => `${role.label}: ${role.reason}`),
    scryfall_oracle_tags: card.oracleTags,
    scryfall_art_tags: card.artTags,
    derived_local_tags: card.localTags,
    strict_theme_count: allBoardThemeCounts.get(`${card.board}:${card.index}`).count,
    strict_theme_fit_percent: allBoardThemeCounts.get(`${card.board}:${card.index}`).percent,
    theme_roles: (archetypeRolesByCard.get(`${card.board}:${card.index}`) ?? []).map((role) => `${role.archetype} (${role.role}; ${role.ruleId}; ${role.reason})`),
    standalone_tier: card.quality.standaloneTier,
    quality_score: card.quality.score,
    good_on_own: card.quality.goodOnOwn,
    synergy_need: card.quality.synergyNeed,
    estimated_average_card_advantage: card.quality.advantageLabel,
    estimated_best_card_advantage: card.quality.bestAdvantageLabel,
    average_case: card.quality.averageCase,
    best_case: card.quality.bestCase,
    speed: card.quality.speed,
    combat_effectiveness: card.quality.combatEffectiveness,
    combat_role: card.quality.combatRole,
    cubecobra_elo: card.quality.elo,
    cubecobra_pick_count: card.pickCount,
    cubecobra_cube_count: card.cubeCount,
    cubecobra_popularity: card.popularity,
    released_at: card.releasedAt,
    first_print_year: card.firstPrintYear,
    cut_review_tier: weaknessByCard.get(`${card.board}:${card.index}`)?.reviewTier ?? '',
    cut_review_score: weaknessByCard.get(`${card.board}:${card.index}`)?.reviewScore ?? '',
    cut_review_reasons: weaknessByCard.get(`${card.board}:${card.index}`)?.reasons.map((reason) => `${reason.label}: ${reason.evidence}`) ?? [],
    cut_review_protections: weaknessByCard.get(`${card.board}:${card.index}`)?.protections.map((reason) => `${reason.label}: ${reason.evidence}`) ?? [],
    seventeenlands_score: card.seventeenLands?.score ?? '',
    seventeenlands_grade: card.seventeenLands?.grade ?? '',
    seventeenlands_gih_win_rate: card.seventeenLands?.gihWinRate ?? '',
    seventeenlands_games_in_hand: card.seventeenLands?.gamesInHand ?? '',
    seventeenlands_improvement_in_hand: card.seventeenLands?.improvementInHand ?? '',
    seventeenlands_average_seen_at: card.seventeenLands?.avgSeen ?? '',
    seventeenlands_average_pick: card.seventeenLands?.avgPick ?? '',
    scryfall_id: card.cardID,
    image_url: card.image,
  }));
  const proposed = {
    generatedAt,
    cube: data.cube,
    managedPrefixes,
    semanticGate: { contract: 'strict-v2', verificationRequired: true },
    cards: cards.map((card) => ({ board: card.board, index: card.index, cardID: card.cardID, name: card.name, tags: card.proposedTags })),
  };
  const seventeenLandsRows = mainboard.map((card) => ({
    name: card.name,
    matched: Boolean(card.seventeenLands),
    score: card.seventeenLands?.score ?? '',
    grade: card.seventeenLands?.grade ?? '',
    gih_win_rate: card.seventeenLands?.gihWinRate ?? '',
    games_in_hand: card.seventeenLands?.gamesInHand ?? '',
    improvement_in_hand: card.seventeenLands?.improvementInHand ?? '',
    average_last_seen_at: card.seventeenLands?.avgSeen ?? '',
    average_pick: card.seventeenLands?.avgPick ?? '',
    game_win_rate: card.seventeenLands?.gameWinRate ?? '',
    theme_roles: (archetypeRolesByCard.get(`${card.board}:${card.index}`) ?? []).map((role) => `${role.archetype} (${role.role})`),
    review_for_cut: cutCandidateIds.includes(`${card.board}:${card.index}`),
  }));
  const instantSorceryRows = instantSorcerySpecificIds.map((id) => {
    const card = mainboardById.get(id);
    return { name: card.name, color: card.colorLabel, mana_value: card.cmc, type: card.type, oracle_text: card.oracleText, seventeenlands_score: card.seventeenLands?.score ?? '', seventeenlands_grade: card.seventeenLands?.grade ?? '' };
  });
  const weakCardRows = weakCards.map((item) => {
    const card = mainboardById.get(item.id);
    const weakness = item.weakness;
    return {
      card_id: item.id,
      name: card.name,
      color_identity: card.colorLabel,
      mana_value: card.cmc,
      review_tier: weakness.reviewTier,
      review_score: weakness.reviewScore,
      negative_signals: weakness.negativeSignals,
      strict_theme_count: themeCountById.get(item.id) ?? 0,
      meaningful_theme_count: weakness.meaningfulThemeCount,
      quality_score: card.quality.score,
      cubecobra_elo: Math.round(card.elo),
      cubecobra_elo_percentile: weakness.communityEloPercentile,
      cubecobra_pick_count: card.pickCount,
      cubecobra_pick_volume_percentile: weakness.communityPickVolumePercentile ?? '',
      cubecobra_cube_count: card.cubeCount,
      cubecobra_cube_count_percentile: weakness.communityCubeCountPercentile ?? '',
      first_print_year: card.firstPrintYear,
      community_history_mature: weakness.communityHistoryMature,
      seventeenlands_score: card.seventeenLands?.score ?? '',
      seventeenlands_games_in_hand: card.seventeenLands?.gamesInHand ?? '',
      reasons: weakness.reasons.map((reason) => `${reason.label}: ${reason.evidence}`),
      protections: weakness.protections.map((reason) => `${reason.label}: ${reason.evidence}`),
      local_pick_evidence: weakness.localPickEvidence,
    };
  });
  const overlapRows = themeCounts.map((item) => ({
    card_id: item.id,
    name: item.name,
    strict_theme_count: item.count,
    strict_theme_fit_percent: item.percentOfThemes,
    themes: [...new Set((archetypeRolesByCard.get(item.id) ?? []).map((role) => role.archetype))],
  }));
  const experimentRows = guildExperiments.map((experiment) => ({
    id: experiment.id,
    name: experiment.name,
    colors: experiment.colors.join(''),
    enablers: experiment.roleCardIds.enablers.length,
    payoffs: experiment.roleCardIds.payoffs.length,
    glue: experiment.roleCardIds.glue.length,
    first_color_enablers: experiment.roleColorContributions.enablers[experiment.colors[0]],
    first_color_payoffs: experiment.roleColorContributions.payoffs[experiment.colors[0]],
    second_color_enablers: experiment.roleColorContributions.enablers[experiment.colors[1]],
    second_color_payoffs: experiment.roleColorContributions.payoffs[experiment.colors[1]],
    support_cards: experiment.supportIds.length,
    flexible_cards: experiment.flexibleCards.length,
    more_enablers_than_payoffs: experiment.balanceGoalMet,
    packet_both_chance: experiment.visibility.packet.bothChance,
    table_both_chance: experiment.visibility.table.bothChance,
    verdict: experiment.verdict,
  }));
  const rejectedRows = data.diagnostics.rejectedNominations.map((item) => ({
    theme: item.theme,
    card_id: item.id,
    card: item.name,
    scryfall_nominations: item.tags,
    decision: 'Rejected: no strict type, numeric, or oracle-text rule matched.',
  }));

  await Promise.all([
    ...auditPackets,
    fs.writeFile(path.join(outputDir, 'analysis.json'), `${JSON.stringify(data, null, 2)}\n`),
    fs.writeFile(path.join(outputDir, 'card-taxonomy-audit.jsonl'), `${taxonomyAudit.map((entry) => JSON.stringify(entry)).join('\n')}\n`),
    fs.writeFile(path.join(outputDir, 'taxonomy-audit-summary.json'), `${JSON.stringify({
      generatedAt,
      cubeVersion: raw.version,
      boards: Object.fromEntries(boards.map((board) => [board, taxonomyAudit.filter((entry) => entry.board === board).length])),
      cards: taxonomyAudit.length,
      themesPerCard: STRICT_THEMES.length,
      roleDecisions: data.summary.auditedRoleDecisions,
      cardsWithNotes: data.summary.cardsWithAuditNotes,
      packetSize: 100,
      packets: Math.ceil(taxonomyAudit.length / 100),
    }, null, 2)}\n`),
    fs.writeFile(path.join(outputDir, 'new-card-findings.json'), `${JSON.stringify({
      fromVersion: changes.fromVersion,
      toVersion: changes.toVersion,
      added: newCardFindings,
      removed: changes.removed,
    }, null, 2)}\n`),
    fs.writeFile(path.join(outputDir, 'proposed-live-tags.json'), `${JSON.stringify(proposed, null, 2)}\n`),
    fs.writeFile(path.join(outputDir, 'card-tag-map.csv'), csv(Object.keys(cardRows[0]), cardRows)),
    fs.writeFile(path.join(outputDir, 'scryfall-oracle-tag-frequency.csv'), csv(['tag', 'count'], oracleTagFrequency)),
    fs.writeFile(path.join(outputDir, 'scryfall-art-tag-frequency.csv'), csv(['tag', 'count'], artTagFrequency)),
    fs.writeFile(path.join(outputDir, 'theme-health.csv'), csv(['name', 'colors', 'bestColors', 'status', 'score', 'enablers', 'payoffs', 'glue', 'enablerPayoffRatio', 'supportCards', 'supportPer45'], themes.map((theme) => ({ ...theme, colors: theme.colors.join(''), bestColors: theme.bestColors.join('') })))),
    fs.writeFile(path.join(outputDir, 'pack-visibility.csv'), csv(['name', 'tableReady', 'enablers', 'payoffs', 'supportCards', 'expectedPacketsWithEnabler', 'expectedPacketsWithPayoff', 'expectedCoherentPackets', 'packetEnablerChance', 'packetPayoffChance', 'packetBothChance', 'tableExpectedEnablers', 'tableExpectedPayoffs', 'tableBothChance'], packModel.map((item) => ({
      name: item.name,
      tableReady: item.tableReady,
      enablers: item.enablers,
      payoffs: item.payoffs,
      supportCards: item.supportCards,
      expectedPacketsWithEnabler: item.expectedPacketsWithEnabler,
      expectedPacketsWithPayoff: item.expectedPacketsWithPayoff,
      expectedCoherentPackets: item.expectedCoherentPackets,
      packetEnablerChance: item.packet.enablerChance,
      packetPayoffChance: item.packet.payoffChance,
      packetBothChance: item.packet.bothChance,
      tableExpectedEnablers: item.table.expectedEnablers,
      tableExpectedPayoffs: item.table.expectedPayoffs,
      tableBothChance: item.table.bothChance,
    })))),
    fs.writeFile(path.join(outputDir, 'card-quality.csv'), csv(['board', 'name', 'color', 'mana_value', 'type', 'standalone_tier', 'quality_score', 'good_on_own', 'synergy_need', 'average_card_advantage', 'best_card_advantage', 'speed', 'combat_effectiveness', 'combat_role', 'average_case', 'best_case', 'cubecobra_elo', 'image_url'], cards.map((card) => ({
      board: card.board,
      name: card.name,
      color: card.colorLabel,
      mana_value: card.cmc,
      type: card.type,
      standalone_tier: card.quality.standaloneTier,
      quality_score: card.quality.score,
      good_on_own: card.quality.goodOnOwn,
      synergy_need: card.quality.synergyNeed,
      average_card_advantage: card.quality.advantageLabel,
      best_card_advantage: card.quality.bestAdvantageLabel,
      speed: card.quality.speed,
      combat_effectiveness: card.quality.combatEffectiveness,
      combat_role: card.quality.combatRole,
      average_case: card.quality.averageCase,
      best_case: card.quality.bestCase,
      cubecobra_elo: card.quality.elo,
      image_url: card.image,
    })))),
    fs.writeFile(path.join(outputDir, 'weak-card-review.csv'), csv(Object.keys(weakCardRows[0]), weakCardRows)),
    fs.writeFile(path.join(outputDir, '17lands-card-scores.csv'), csv(Object.keys(seventeenLandsRows[0]), seventeenLandsRows)),
    fs.writeFile(path.join(outputDir, 'instant-sorcery-specific-cards.csv'), csv(Object.keys(instantSorceryRows[0]), instantSorceryRows)),
    fs.writeFile(path.join(outputDir, 'blink-color-health.csv'), csv(['color', 'flicker', 'copy', 'recursion', 'selfBounce', 'enablers', 'payoffs', 'ratio', 'coverage', 'examples'], blink)),
    fs.writeFile(path.join(outputDir, 'strict-overlap.csv'), csv(Object.keys(overlapRows[0]), overlapRows)),
    fs.writeFile(path.join(outputDir, 'guild-experiments.csv'), csv(Object.keys(experimentRows[0]), experimentRows)),
    fs.writeFile(path.join(outputDir, 'rejected-scryfall-nominations.csv'), csv(['theme', 'card_id', 'card', 'scryfall_nominations', 'decision'], rejectedRows)),
    fs.writeFile(path.join(reportDir, 'CUBE_HEALTH_REPORT.md'), strictReportMarkdown(data)),
    fs.writeFile(path.join(root, 'dashboard.html'), renderDashboard(data)),
  ]);

  console.log(JSON.stringify({
    cube: data.cube,
    summary: data.summary,
    themes: themes.map(({ name, status, score, enablers, payoffs, glue, bestColors }) => ({ name, status, score, enablers, payoffs, glue, bestColors })),
    blink,
    hiddenThemes,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
