import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { canonicalTagTuples, digestProposal } from './proposal-digest.mjs';
import { classifyCardQuality } from './card-quality.mjs';
import { renderDashboard } from './dashboard.mjs';
import { STRICT_THEMES, normalizeCard, strictRoleMatches } from './taxonomy.mjs';
import { absentCardFixtures, blinkBoundaryFixtures } from './taxonomy-fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');
const analysisPath = path.join(root, 'outputs', 'analysis.json');
const dashboardPath = path.join(root, 'dashboard.html');
const adjacencyPath = path.join(root, 'data', 'cubecobra-ml', 'cubecobra-adjacency.json');
const [analysisStat, dashboardStat, adjacencyStat] = await Promise.all([fs.stat(analysisPath), fs.stat(dashboardPath), fs.stat(adjacencyPath)]);
for (const source of ['src/taxonomy.mjs', 'src/strategic-support.mjs', 'src/update-history.mjs', 'data/history/cube-history.json', 'src/taxonomy-v555-changes.mjs', 'src/analyze.mjs', 'src/card-quality.mjs', 'src/pack-math.mjs']) {
  const sourceStat = await fs.stat(path.join(root, source));
  assert.ok(analysisStat.mtimeMs >= sourceStat.mtimeMs, `outputs/analysis.json is older than ${source}; run npm run analyze first`);
}
for (const source of ['src/dashboard.mjs', 'src/build-dashboard.mjs']) {
  const sourceStat = await fs.stat(path.join(root, source));
  assert.ok(dashboardStat.mtimeMs >= sourceStat.mtimeMs, `dashboard.html is older than ${source}; run npm run analyze first`);
}
assert.ok(dashboardStat.mtimeMs >= analysisStat.mtimeMs, 'dashboard.html is older than outputs/analysis.json; run npm run build:dashboard first');
// The historical adjacency corpus is a versioned input, not a tag-refresh output.
// Validate its structure below and exact deployed bytes in verify:deploy; Git checkout mtimes are not provenance.
const analysis = JSON.parse(await read('outputs/analysis.json'));
const proposal = JSON.parse(await read('outputs/proposed-live-tags.json'));
const rawCube = JSON.parse(await read('data/raw/cube.json'));
const adjacency = JSON.parse(await read('data/cubecobra-ml/cubecobra-adjacency.json'));
const html = await read('dashboard.html');
const report = await read('reports/CUBE_HEALTH_REPORT.md');
const strictOverlapCsv = parse(await read('outputs/strict-overlap.csv'), { columns: true });
const experimentCsv = parse(await read('outputs/guild-experiments.csv'), { columns: true });
const rejectedCsv = parse(await read('outputs/rejected-scryfall-nominations.csv'), { columns: true });
const cardCsv = parse(await read('outputs/card-tag-map.csv'), { columns: true });
const weakCardCsv = parse(await read('outputs/weak-card-review.csv'), { columns: true });
const taxonomyAudit = (await read('outputs/card-taxonomy-audit.jsonl')).trim().split('\n').map((line) => JSON.parse(line));
const taxonomyAuditSummary = JSON.parse(await read('outputs/taxonomy-audit-summary.json'));
const newCardFindings = JSON.parse(await read('outputs/new-card-findings.json'));
const proposalTuples = canonicalTagTuples(proposal.cards);
const analysisTuples = canonicalTagTuples(analysis.cards, 'proposedTags');
const proposalDigest = digestProposal(proposal.cards);

assert.equal(analysis.cube.shortId, 'style');
assert.ok(analysis.cube.version >= 546);
assert.equal(analysis.cube.mainboardCount, rawCube.cardCount);
assert.equal(analysis.cube.mainboardCount, rawCube.cards.mainboard.length);
assert.equal(analysis.cards.length, analysis.cube.mainboardCount + analysis.cube.maybeboardCount + analysis.cube.basicsCount);
assert.equal(proposal.cards.length, analysis.cards.length);
assert.deepEqual(proposalTuples, analysisTuples, 'Proposed live tags do not match the semantically verified analysis');
const mutatedProposal = structuredClone(proposal.cards);
mutatedProposal[0].tags = [...mutatedProposal[0].tags, 'unverified mutation'];
assert.notEqual(digestProposal(mutatedProposal), proposalDigest, 'Proposal digest does not detect tag mutations');
assert.equal(proposal.semanticGate.contract, 'strict-v2');
assert.equal(proposal.semanticGate.verificationRequired, true);
assert.equal(analysis.themes.length, 27);
assert.equal(analysis.guildExperiments.length, 5);
assert.equal(analysis.blink.length, 6);
assert.equal(analysis.packModel.length, analysis.themes.length);
assert.ok(analysis.overlapDistribution.averageThemesPerCard <= 3, 'Strict taxonomy exceeds the reviewed three-theme-per-card average ceiling');
assert.ok(analysis.overlapDistribution.averageThemesPerCard < 4.22, 'Strict pass did not improve on the permissive baseline');
assert.equal(analysis.overlapDistribution.buckets.reduce((sum, item) => sum + item.count, 0), analysis.cube.mainboardCount);
assert.equal(analysis.diagnostics.rejectedNominations.length, analysis.summary.rejectedScryfallNominations);
const managedPrefixes = [
  'Blink:', 'Theft:', 'Artifact Sac:', 'Big Mana:', 'GW Growth:', 'Aristocrats:', 'Noncombat Damage:',
  'Graveyard:', 'Humans:', 'Counters:', 'Stax:', 'Control:', 'Black Aggro:', 'Red Aggro:', 'Chonkers:',
  'Strict ', 'Function:',
];
const rawById = new Map(['mainboard', 'maybeboard', 'basics'].flatMap((board) => (rawCube.cards?.[board] ?? []).map((entry) => [`${board}:${Number(entry.index)}`, entry])));
for (const proposedCard of proposal.cards) {
  assert.deepEqual(Object.keys(proposedCard).sort(), ['board', 'cardID', 'index', 'name', 'tags'], `${proposedCard.name} proposal contains non-tag mutation fields`);
  const original = rawById.get(`${proposedCard.board}:${proposedCard.index}`);
  assert.ok(original, `${proposedCard.name} proposal does not map to a raw card`);
  assert.equal(proposedCard.cardID, original.cardID, `${proposedCard.name} proposal changed card identity`);
  const customTags = (original.tags ?? []).filter((tag) => !managedPrefixes.some((prefix) => tag.startsWith(prefix)));
  for (const tag of customTags) assert.ok(proposedCard.tags.includes(tag), `${proposedCard.name} dropped custom tag ${tag}`);
}
assert.equal(taxonomyAudit.length, analysis.cards.length, 'Per-card taxonomy audit does not cover every board');
assert.equal(taxonomyAuditSummary.cards, analysis.cards.length);
assert.deepEqual(taxonomyAuditSummary.boards, Object.fromEntries(['mainboard', 'maybeboard', 'basics'].map((board) => [board, rawCube.cards[board].length])));
assert.equal(taxonomyAuditSummary.themesPerCard, analysis.themes.length);
assert.equal(taxonomyAuditSummary.roleDecisions, analysis.cards.length * analysis.themes.length * 3);
assert.equal(newCardFindings.fromVersion, analysis.changes.fromVersion);
assert.equal(newCardFindings.toVersion, rawCube.version);
assert.equal(newCardFindings.added.length, analysis.changes.added.length);
assert.deepEqual(newCardFindings.removed, analysis.changes.removed);
assert.ok(newCardFindings.added.every((item) => item.cardId && item.oracleText && item.auditStatus !== 'missing'), 'A v555 addition lacks exact audited findings');
for (const audited of taxonomyAudit) {
  assert.equal(audited.themes.length, analysis.themes.length, `${audited.name} did not receive every theme review`);
  assert.equal(audited.reviewedThemeCount, analysis.themes.length, `${audited.name} theme review count is stale`);
  assert.ok(audited.oracleText || audited.board === 'basics', `${audited.name} has no reviewed Oracle text`);
  for (const theme of audited.themes) {
    assert.equal(theme.roles.length, 3, `${audited.name}/${theme.theme} lacks assigned/unassigned role evidence`);
    assert.ok(theme.roles.every((role) => role.ruleId && role.evidence), `${audited.name}/${theme.theme} has incomplete role evidence`);
  }
  const analyzed = analysis.cards.find((item) => item.id === audited.id);
  const acceptedRoleCount = audited.themes.reduce((sum, theme) => sum + theme.roles.filter((role) => role.assigned).length, 0);
  assert.equal(analyzed.archetypeRoles.length, acceptedRoleCount, `${audited.name} dashboard roles disagree with the all-board audit`);
  assert.equal(analyzed.strictThemeCount, audited.acceptedThemeCount, `${audited.name} strict theme count disagrees with the all-board audit`);
}

for (const theme of analysis.themes) {
  assert.ok(theme.sourceTags.length, `${theme.name} has no discovery tags`);
  assert.ok(!theme.name.includes(' / '), `${theme.name} combines themes with a slash`);
  assert.ok(!/\band\b/i.test(theme.name), `${theme.name} combines multiple concepts`);
  for (const role of ['enablers', 'payoffs', 'glue']) {
    assert.equal(theme.roleCardIds[role].length, theme[role], `${theme.name} ${role} count mismatch`);
    assert.equal(theme.roleEvidence[role].length, theme[role], `${theme.name} ${role} evidence mismatch`);
    for (const evidence of theme.roleEvidence[role]) {
      assert.ok(evidence.ruleId, `${theme.name} has an accepted role without a rule ID`);
      assert.ok(evidence.reason, `${theme.name} has an accepted role without a reason`);
    }
  }
}

for (const card of analysis.cards) {
  assert.ok(card.image, `${card.name} is missing its card image`);
  assert.ok(Number.isFinite(card.strictThemeCount), `${card.name} is missing a strict theme count`);
  assert.ok(Number.isFinite(card.strictThemePercent), `${card.name} is missing a strict theme percentage`);
  assert.ok(['reviewed', 'reviewed-with-notes'].includes(card.taxonomyAuditStatus), `${card.name} is missing its durable audit status`);
  assert.ok(Array.isArray(card.adjacentMechanics), `${card.name} is missing adjacent-mechanic evidence`);
  for (const role of card.archetypeRoles) {
    assert.ok(role.ruleId, `${card.name} has a role without a rule ID`);
    assert.ok(role.reason, `${card.name} has a role without evidence`);
  }
  for (const role of card.functionRoles) {
    assert.ok(['interaction', 'value'].includes(role.id), `${card.name} has an unknown functional role`);
    assert.ok(role.reason, `${card.name} has a functional role without evidence`);
  }
}
for (const current of analysis.cards.filter((item) => item.board === 'mainboard')) {
  if (/\bArtifact\b/i.test(current.type)) assert.ok(current.archetypeRoles.some((role) => role.archetypeId === 'artifacts' && role.role === 'enablers'), `${current.name} lost its Artifact type role`);
  if (/\bEnchantment\b/i.test(current.type)) assert.ok(current.archetypeRoles.some((role) => role.archetypeId === 'enchantments' && role.role === 'enablers'), `${current.name} lost its Enchantment type role`);
  if (!/\bLand\b/i.test(current.type) && !/\bCreature\b/i.test(current.type)) assert.ok(current.archetypeRoles.some((role) => role.archetypeId === 'noncreature-spells' && role.role === 'enablers'), `${current.name} lost its noncreature type role`);
}

const independentFixtures = absentCardFixtures.map((entry) => {
  const fixture = normalizeCard(entry, 'fixture');
  fixture.inactiveInCubeFormat = false;
  return fixture;
});
const card = (name) => {
  const found = analysis.cards.find((item) => item.board === 'mainboard' && item.name === name) ?? independentFixtures.find((item) => item.name === name);
  assert.ok(found, `Required semantic fixture ${name} is missing`);
  return found;
};
const hasRole = (name, themeId, role = null) => {
  const target = card(name);
  if (target.board !== 'fixture') return target.archetypeRoles.some((item) => item.archetypeId === themeId && (!role || item.role === role));
  return strictRoleMatches(STRICT_THEMES.find((theme) => theme.id === themeId), target).some((item) => !role || item.role === role);
};
const semanticExpectations = [
  ['Yawgmoth, Thran Physician', 'noncreature-spells', null, false],
  ['Yawgmoth, Thran Physician', 'attack-triggers', null, false],
  ['Yawgmoth, Thran Physician', 'combat-damage', null, false],
  ['Yawgmoth, Thran Physician', 'theft', null, false],
  ['Yawgmoth, Thran Physician', 'taxes', null, false],
  ['Yawgmoth, Thran Physician', 'blink', null, false],
  ['Yawgmoth, Thran Physician', 'sacrifice', 'enablers', true],
  ['Yawgmoth, Thran Physician', 'pp-counters', 'glue', true],
  ["Yawgmoth's Will", 'blink', 'enablers', false],
  ["Yawgmoth's Will", 'graveyard-casting', 'payoffs', true],
  ["Yawgmoth's Will", 'reanimator', null, false],
  ['Bonecrusher Giant', 'power-four', 'enablers', true],
  ["Thalia's Lieutenant", 'noncreature-spells', null, false],
  ['Malcolm, Alluring Scoundrel', 'pp-counters', null, false],
  ['Gix, Yawgmoth Praetor', 'combat-damage', 'enablers', true],
  ['Gix, Yawgmoth Praetor', 'combat-damage', 'payoffs', false],
  ['Gix, Yawgmoth Praetor', 'attack-triggers', null, false],
  ['Faithless Looting', 'reanimator', 'enablers', true],
  ['Birds of Paradise', 'ramp', 'enablers', true],
  ['Junk Jet', 'power-matters', 'payoffs', true],
  ['Monstrous Emergence', 'power-matters', 'payoffs', true],
  ['Fury', 'noncombat-damage', 'payoffs', false],
  ['Hostile Investigator', 'reanimator', 'enablers', false],
  ['Necropotence', 'reanimator', 'enablers', false],
  ['Altar of the Wretched', 'artifacts', 'payoffs', false],
  ['Perilous Snare', 'artifacts', 'payoffs', false],
  ['Prophetic Prism', 'artifacts', 'payoffs', false],
  ['Weapons Manufacturing', 'artifacts', 'payoffs', true],
  ['Weapons Manufacturing', 'sacrifice', 'payoffs', true],
  ['Weapons Manufacturing', 'tokens', 'enablers', true],
  ['Weapons Manufacturing', 'tokens', 'payoffs', false],
  ['Krang, Master Mind', 'artifacts', 'payoffs', true],
  ['Kappa Cannoneer', 'artifacts', 'payoffs', true],
  ['Charismatic Conqueror', 'artifacts', 'payoffs', false],
  ['Charismatic Conqueror', 'blink', 'payoffs', false],
  ['Dockside Extortionist', 'artifacts', 'payoffs', false],
  ['Generous Plunderer', 'artifacts', 'payoffs', false],
  ['Touch the Spirit Realm', 'artifacts', 'payoffs', false],
  ['Hostage Taker', 'artifacts', 'payoffs', false],
  ['Everything Pizza', 'artifacts', 'payoffs', false],
  ['Kellan, the Fae-Blooded', 'equipment', 'payoffs', true],
  ['Kellan, the Fae-Blooded', 'equipment', 'glue', true],
  ['Starfield Vocalist', 'blink', 'payoffs', true],
  ['Panharmonicon', 'blink', 'payoffs', true],
  ['Delney, Streetwise Lookout', 'blink', 'payoffs', true],
  ['Wall of Omens', 'blink', 'glue', false],
  ['Wall of Omens', 'blink', 'payoffs', true],
  ['Rick, Steadfast Leader', 'humans', 'payoffs', true],
  ['Return of the Wildspeaker', 'humans', 'payoffs', false],
  ['Parting Gust', 'pp-counters', 'enablers', true],
  ['Parting Gust', 'pp-counters', 'payoffs', false],
  ['Reanimate', 'blink', 'enablers', false],
  ['Reanimate', 'reanimator', 'payoffs', true],
  ['Jaxis, the Troublemaker', 'blink', 'enablers', false],
  ['Fable of the Mirror-Breaker', 'blink', 'enablers', false],
  ['Silent Hallcreeper', 'blink', null, false],
  ['Wildgrowth Archaic', 'blink', null, false],
  ["Green Sun's Twilight", 'landfall', 'enablers', true],
  ['Primeval Titan', 'landfall', 'enablers', true],
  ['Golos, Tireless Pilgrim', 'landfall', 'enablers', true],
  ['Solemn Simulacrum', 'landfall', 'enablers', true],
  ['Extract Brain', 'opponent-cards', 'enablers', true],
  ['Villainous Wealth', 'opponent-cards', 'enablers', true],
  ['Command the Chaff', 'opponent-cards', 'enablers', true],
  ["Gríma, Saruman's Footman", 'opponent-cards', 'enablers', true],
  ['Scarlet Witch, Chaotic Avenger', 'opponent-cards', 'enablers', false],
  ['Scarlet Witch, Chaotic Avenger', 'combat-damage', 'enablers', true],
  ['Powerbalance', 'opponent-cards', 'enablers', false],
  ['Teferi, Time Raveler', 'opponent-cards', 'enablers', false],
  ['Magmablood Archaic', 'pp-counters', 'payoffs', false],
  ['Wildgrowth Archaic', 'pp-counters', 'payoffs', false],
  ['Éomer, King of Rohan', 'pp-counters', 'payoffs', false],
  ['Mossborn Hydra', 'pp-counters', 'payoffs', true],
  ['Braids, Conjurer Adept', 'landfall', 'enablers', false],
  ['Nishoba Brawler', 'power-matters', 'enablers', true],
  ['Nishoba Brawler', 'power-four', 'enablers', false],
  ['Ledger Shredder', 'reanimator', 'enablers', true],
  ['Ledger Shredder', 'pp-counters', 'enablers', true],
  ['Ledger Shredder', 'draw-matters', 'enablers', true],
  ["Dragon's Rage Channeler", 'graveyard-types', 'payoffs', true],
  ['Faithless Looting', 'graveyard-types', 'enablers', true],
  ['Agent of the Iron Throne', 'artifacts', 'payoffs', true],
  ['Agent of the Iron Throne', 'sacrifice', 'payoffs', false],
  ['Agent of the Iron Throne', 'dies', 'payoffs', true],
  ['Marionette Master', 'artifacts', 'payoffs', true],
  ['Marionette Apprentice', 'artifacts', 'payoffs', true],
  ['Forensic Gadgeteer', 'artifacts', 'payoffs', true],
  ['Ravenous Robots', 'artifacts', 'payoffs', true],
  ['Pinnacle Emissary', 'artifacts', 'payoffs', true],
  ['Goblin Engineer', 'artifacts', 'payoffs', true],
  ["Breya's Apprentice", 'artifacts', 'payoffs', true],
  ['Tempestra, Dame of Games', 'artifacts', 'payoffs', true],
  ['Fain, the Broker', 'artifacts', 'payoffs', true],
  ['Sokenzan Smelter', 'artifacts', 'payoffs', true],
  ['Deadly Dispute', 'artifacts', 'payoffs', false],
  ['Fanatical Offering', 'artifacts', 'payoffs', false],
  ["Reckoner's Bargain", 'artifacts', 'payoffs', false],
  ["Tarrian's Journal", 'artifacts', 'payoffs', false],
  ['Midgar, City of Mako', 'artifacts', 'payoffs', false],
  ['Umbral Collar Zealot', 'artifacts', 'payoffs', false],
  ['Ayara, Widow of the Realm', 'artifacts', 'payoffs', false],
  ['Arcane Signet', 'artifacts', 'enablers', true],
  ['Arcane Signet', 'ramp', 'enablers', true],
  ['Prophetic Prism', 'ramp', 'enablers', false],
  ['Imprisoned in the Moon', 'ramp', 'enablers', false],
  ['Rakdos Signet', 'ramp', 'enablers', true],
  ['H.E.R.B.I.E., Lovable Robot', 'ramp', 'enablers', true],
  ['Bala Ged Recovery', 'ramp', null, false],
  ['Fear of Missing Out', 'attack-triggers', 'enablers', true],
  ['Fear of Missing Out', 'attack-triggers', 'payoffs', false],
  ['Fable of the Mirror-Breaker', 'attack-triggers', 'enablers', true],
  ['Fable of the Mirror-Breaker', 'attack-triggers', 'payoffs', false],
  ['Hanweir Garrison', 'attack-triggers', 'enablers', true],
  ['Hanweir Garrison', 'attack-triggers', 'payoffs', false],
  ['Hellrider', 'attack-triggers', 'enablers', true],
  ['Hellrider', 'attack-triggers', 'payoffs', false],
  ['Etali, Primal Storm', 'attack-triggers', 'enablers', true],
  ['Etali, Primal Storm', 'attack-triggers', 'payoffs', false],
  ['Delney, Streetwise Lookout', 'attack-triggers', 'payoffs', true],
  ['Mondrak, Glory Dominus', 'tokens', 'payoffs', true],
  ['Exalted Sunborn', 'tokens', 'payoffs', true],
  ['Elspeth, Storm Slayer', 'tokens', 'payoffs', true],
  ['Academy Manufactor', 'tokens', 'payoffs', true],
  ['Academy Manufactor', 'tokens', 'enablers', false],
  ['Elspeth, Storm Slayer', 'tokens', 'enablers', true],
  ['Vial Smasher the Fierce', 'noncombat-damage', 'enablers', true],
  ['Leyline Binding', 'five-color-domain', 'payoffs', true],
  ['Nishoba Brawler', 'five-color-domain', 'payoffs', true],
  ["Spara's Headquarters", 'five-color-domain', 'enablers', true],
  ['Golos, Tireless Pilgrim', 'five-color-domain', 'payoffs', true],
  ['Arcane Signet', 'five-color-domain', 'enablers', false],
  ['Arcane Signet', 'five-color-domain', 'glue', true],
  ['Fable of the Mirror-Breaker', 'five-color-domain', 'enablers', false],
  ['Fable of the Mirror-Breaker', 'five-color-domain', 'glue', false],
  ['Skycoach Conductor', 'blink', 'enablers', true],
  ['Skycoach Conductor', 'blink', 'payoffs', true],
  ["Conjurer's Closet", 'blink', 'enablers', true],
  ['Soulherder', 'blink', 'payoffs', true],
  ['Fable of the Mirror-Breaker', 'blink', 'payoffs', true],
  ['Tifa Lockhart', 'blink', 'payoffs', false],
  ['Tifa Lockhart', 'landfall', 'payoffs', true],
  ['Narfi, Betrayer King', 'blink', 'enablers', false],
  ['Narfi, Betrayer King', 'reanimator', 'payoffs', true],
  ['Abomination, World Ravager', 'discard', 'payoffs', true],
  ['Abomination, World Ravager', 'graveyard-casting', 'payoffs', true],
  ['Bilbo, Luckwearer', 'discard', 'enablers', true],
  ['Monstrosity of the Lake', 'discard', 'enablers', true],
  ['Lockjaw, Slobbering Teleporter', 'noncreature-spells', 'payoffs', true],
  ['H.E.R.B.I.E., Lovable Robot', 'noncreature-spells', 'payoffs', true],
  ['Breach the Multiverse', 'reanimator', 'payoffs', true],
  ['Aurora Awakener', 'five-color-domain', 'payoffs', true],
  ['Stridehangar Automaton', 'artifacts', 'payoffs', true],
  ['Negan, the Cold-Blooded', 'blink', 'payoffs', true],
  ['Dismissive Pyromancer', 'discard', 'enablers', true],
  ['Guildsworn Prowler', 'dies', 'enablers', true],
  ['Fight for the Throne', 'dies', 'payoffs', false],
  ['Massacre Wurm', 'dies', 'payoffs', false],
  ['Natural Order', 'dies', 'payoffs', true],
  ['Natural Order', 'sacrifice', 'enablers', true],
  ['Mjölnir, Hammer of Thor', 'noncombat-damage', 'enablers', true],
  ['Mjölnir, Hammer of Thor', 'noncombat-damage', 'payoffs', false],
  ['Mjölnir, Hammer of Thor', 'noncombat-damage', 'glue', true],
  ['Mana Crypt', 'noncombat-damage', 'enablers', false],
  ['City of Brass', 'noncombat-damage', 'enablers', false],
  ["Aminatou's Augury", 'ramp', 'payoffs', false],
  ['Blightsteel Colossus', 'ramp', 'payoffs', true],
];
for (const [name, themeId, role, expected] of semanticExpectations) {
  assert.equal(hasRole(name, themeId, role), expected, `${name} ${expected ? 'is missing' : 'was falsely assigned to'} ${themeId}${role ? ` (${role})` : ''}`);
}

const syntheticIsshin = normalizeCard({
  cardID: 'fixture-isshin',
  index: 0,
  details: {
    name: 'Isshin, Two Heavens as One',
    type: 'Legendary Creature — Human Samurai',
    oracle_text: 'If a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.',
    color_identity: ['W', 'B', 'R'],
    power: '3',
    toughness: '4',
  },
}, 'fixture');
syntheticIsshin.inactiveInCubeFormat = false;
const attackFixtureRoles = strictRoleMatches(STRICT_THEMES.find((theme) => theme.id === 'attack-triggers'), syntheticIsshin);
assert.ok(attackFixtureRoles.some((role) => role.role === 'payoffs'), 'Isshin fixture is not classified as an Attack Triggers hard payoff');
assert.ok(!attackFixtureRoles.some((role) => role.role === 'enablers'), 'Isshin fixture was falsely classified as an Attack Triggers enabler');

const syntheticMixedEnterTriggers = normalizeCard({
  cardID: 'fixture-mixed-enter-triggers',
  index: 1,
  details: {
    name: 'Mixed Enter Triggers',
    type: 'Creature — Human Wizard',
    oracle_text: 'Whenever an artifact an opponent controls enters untapped, tap it.\nWhen Mixed Enter Triggers enters, draw a card.',
    color_identity: ['U'],
    power: '2',
    toughness: '2',
  },
}, 'fixture');
syntheticMixedEnterTriggers.inactiveInCubeFormat = false;
const mixedBlinkRoles = strictRoleMatches(STRICT_THEMES.find((theme) => theme.id === 'blink'), syntheticMixedEnterTriggers);
assert.ok(mixedBlinkRoles.some((role) => role.role === 'payoffs'), 'A valid own-enter trigger was suppressed by a separate opponent-enter trigger');

const syntheticOpponentControlEnter = normalizeCard({
  cardID: 'fixture-opponent-control-enter',
  index: 2,
  details: {
    name: 'Opponent Control Enter',
    type: 'Creature — Human Advisor',
    oracle_text: "Whenever a creature enters under an opponent's control, scry 1.",
    color_identity: ['W'],
    power: '2',
    toughness: '2',
  },
}, 'fixture');
syntheticOpponentControlEnter.inactiveInCubeFormat = false;
const opponentControlBlinkRoles = strictRoleMatches(STRICT_THEMES.find((theme) => theme.id === 'blink'), syntheticOpponentControlEnter);
assert.ok(!opponentControlBlinkRoles.some((role) => role.role === 'payoffs'), 'An opponent-controlled enter trigger was falsely accepted as a Blink payoff');

const syntheticPluralOwnEnter = normalizeCard({
  cardID: 'fixture-plural-own-enter',
  index: 3,
  details: {
    name: 'Plural Own Enter',
    type: 'Creature — Vampire',
    oracle_text: 'Whenever one or more other creatures with power 2 or less enter the battlefield under your control, draw a card.',
    color_identity: ['W'],
    power: '2',
    toughness: '2',
  },
}, 'fixture');
syntheticPluralOwnEnter.inactiveInCubeFormat = false;
const pluralOwnBlinkRoles = strictRoleMatches(STRICT_THEMES.find((theme) => theme.id === 'blink'), syntheticPluralOwnEnter);
assert.ok(pluralOwnBlinkRoles.some((role) => role.role === 'payoffs'), 'A plural own-enter trigger was not accepted as a Blink payoff');

const syntheticPluralOpponentEnter = normalizeCard({
  cardID: 'fixture-plural-opponent-enter',
  index: 4,
  details: {
    name: 'Plural Opponent Enter',
    type: 'Creature — Vampire',
    oracle_text: 'Whenever one or more creatures your opponents control enter, tap those creatures.',
    color_identity: ['W'],
    power: '2',
    toughness: '2',
  },
}, 'fixture');
syntheticPluralOpponentEnter.inactiveInCubeFormat = false;
const pluralOpponentBlinkRoles = strictRoleMatches(STRICT_THEMES.find((theme) => theme.id === 'blink'), syntheticPluralOpponentEnter);
assert.ok(!pluralOpponentBlinkRoles.some((role) => role.role === 'payoffs'), 'A plural opponent-enter trigger was falsely accepted as a Blink payoff');

assert.ok(hasRole('Welcoming Vampire', 'blink', 'payoffs'), 'Welcoming Vampire is missing its plural Blink payoff trigger');

const blinkTheme = STRICT_THEMES.find((theme) => theme.id === 'blink');
const boundaryCards = new Map(blinkBoundaryFixtures.map((entry) => {
  const fixture = normalizeCard(entry, 'fixture');
  fixture.inactiveInCubeFormat = false;
  return [fixture.name, fixture];
}));
const boundaryRole = (name, role) => strictRoleMatches(blinkTheme, boundaryCards.get(name)).some((item) => item.role === role);
assert.equal(boundaryRole('Intentional Flicker', 'enablers'), true, 'Intentional exile-and-return fixture is not a Blink enabler');
for (const name of ['Only Reanimate', 'Only Copy', 'Only Bounce']) assert.equal(boundaryRole(name, 'enablers'), false, `${name} leaked into Blink`);
assert.equal(boundaryRole('Own Entry', 'payoffs'), true, 'Own-side reusable entry trigger is missing from Blink payoffs');
for (const name of ['Opponent Entry', 'Land Entry', 'Cast Entry']) assert.equal(boundaryRole(name, 'payoffs'), false, `${name} leaked into Blink payoffs`);

const history = analysis.updateHistory;
assert.equal(history.available, true, 'Published dashboard requires dated change history');
assert.equal(history.coverage.complete, true, 'History must not silently truncate pagination');
assert.equal(new Set(history.events.map(event => event.id)).size, history.events.length, 'Duplicate update records');
assert.ok(history.events.every(event => Number.isFinite(Date.parse(event.date))), 'Updates must carry real dates');
assert.equal(history.events.reduce((n,event)=>n+event.added.length-event.removed.length,0), analysis.cube.mainboardCount, 'Complete changelog net additions must reconcile with the mainboard');

const experiments = new Map(analysis.guildExperiments.map((item) => [item.id, item]));
for (const id of ['rg-power-four', 'rg-power-matters', 'ug-counters', 'ug-landfall', 'gw-counters']) assert.ok(experiments.has(id), `Missing experiment ${id}`);
for (const experiment of experiments.values()) {
  assert.ok(experiment.visibility.packet.bothChance >= 0 && experiment.visibility.packet.bothChance <= 100);
  assert.ok(experiment.visibility.table.bothChance >= 0 && experiment.visibility.table.bothChance <= 100);
}
for (const experiment of experiments.values()) assert.equal(experiment.balanceGoalMet, experiment.roleCardIds.enablers.length > experiment.roleCardIds.payoffs.length, `${experiment.id} balance must reflect actual support, not a desired result`);
for (const id of ['rg-power-four', 'rg-power-matters']) assert.match(experiments.get(id).verdict, /early inputs|early support/i);
assert.equal(experiments.get('ug-landfall').balanceGoalMet, true, 'UG Landfall no longer has more enablers than payoffs');
assert.equal(experiments.get('ug-landfall').roleColorContributions.payoffs.U, 0, 'UG Landfall is no longer payoff-light in blue; update its verdict');
assert.match(experiments.get('ug-landfall').verdict, /green-heavy/i, 'UG Landfall no longer explains its missing blue payoff support');
assert.ok(experiments.get('ug-counters').roleColorContributions.payoffs.U > 0, 'UG Counters has no blue payoff support');
assert.equal(experiments.get('ug-counters').roleCardIds.payoffs.length, experiments.get('gw-counters').roleCardIds.payoffs.length + 1, 'UG no longer has exactly one more strict counter payoff than GW; update the audit verdict');
assert.ok(experiments.get('ug-counters').roleColorContributions.payoffs.U > experiments.get('gw-counters').roleColorContributions.payoffs.W, 'UG no longer has more off-green counter payoffs than GW; update the audit verdict');
assert.equal(experiments.get('rg-power-four').roleColorContributions.payoffs.R, 0, 'RG Power 4+ now has a red threshold payoff; update the audit verdict');

const marker = '<script>const DATA=';
const payloadStart = html.indexOf(marker) + marker.length;
const payloadEnd = html.indexOf(';</script>', payloadStart);
assert.ok(payloadStart >= marker.length, 'Dashboard data marker is missing');
assert.ok(payloadEnd > payloadStart, 'Dashboard data terminator is missing');
const embedded = JSON.parse(html.slice(payloadStart, payloadEnd));
assert.equal(html, renderDashboard(analysis), 'dashboard.html is not an exact render of current source and outputs/analysis.json');
assert.equal(embedded.cube.version, analysis.cube.version);
assert.equal(embedded.cards.length, analysis.cards.length);
assert.equal(embedded.cubeAdjacency.source.qualifyingCubes, adjacency.source.qualifyingCubes, 'Standalone dashboard is missing embedded CubeCobra adjacency data');
for (const tab of ['overview', 'themes', 'health', 'cuts', 'adjacency']) assert.ok(html.includes(`data-tab="${tab}"`), `Primary dashboard destination ${tab} is missing`);
for (const section of ['overview', 'themes', 'guilds', 'overlap', 'cuts', 'review', 'focus', 'map', 'packets', 'seventeen', 'quality', 'health', 'blink', 'hidden', 'tribes', 'types', 'cards', 'adjacency', 'discover', 'tags']) assert.ok(html.includes(`id="${section}"`), `Dashboard section ${section} is missing`);
assert.ok(html.includes('id="subview-select"'), 'Dashboard is missing its secondary view selector');
assert.ok(html.includes('<option value="all">All mainboard cards</option>'), 'Strict browser is missing the All mainboard option');
assert.ok(html.includes('id="refetch-button"'), 'Dashboard is missing the read-only Cube Cobra refetch action');
assert.ok(html.includes('cube/api/cubeJSON/style'), 'Dashboard refetch does not target the public Cube Cobra endpoint');
assert.ok(html.includes('id="discover-query"'), 'Dashboard is missing the visible Scryfall query');
assert.ok(html.includes('api.scryfall.com/cards/search'), 'Dashboard is missing live Scryfall discovery');
assert.ok(html.includes('json.edhrec.com/pages/cards/'), 'Dashboard is missing live EDHREC Lift evidence');
assert.ok(html.includes('data/cubecobra-adjacency.json'), 'Dashboard is missing CubeCobra co-cube evidence');
assert.ok(html.includes('id="adjacency-source"'), 'Dashboard is missing separate CubeCobra and EDHREC adjacency modes');
assert.ok(html.includes('data-anchor-weight'), 'Dashboard is missing per-anchor weights');
assert.ok(html.includes('assets/mana/W.svg'), 'Dashboard is not using local mana symbols');
assert.ok(html.includes('prefers-reduced-motion'), 'Dashboard does not respect reduced-motion preferences');
assert.ok(html.includes('id="theme-colors"'), 'Theme browser is missing the multi-color pool');
assert.ok(html.includes('id="theme-types"'), 'Theme browser is missing its additive card-type filter');
assert.ok(html.includes('id="theme-type-mode"'), 'Theme browser is missing Any/All type matching');
assert.ok(html.includes('id="theme-performance"'), 'Theme browser is missing its performance filter');
assert.ok(html.includes('id="theme-sort-direction"'), 'Theme browser is missing ascending and descending sort controls');
assert.ok(html.includes('class="browse-toolbar"'), 'Theme browser is missing its stable multi-row filter layout');
assert.ok(!/\.color-pool\s*\{[^}]*contain:\s*inline-size/.test(html), 'The color fieldset can collapse behind neighboring controls');
assert.ok(!/\.type-pool\s*\{[^}]*contain:\s*inline-size/.test(html), 'The type fieldset can collapse behind neighboring controls');
assert.ok(html.includes('value="seventeen-score"'), 'Theme browser cannot sort by 17Lands score');
assert.ok(html.includes('value="seventeen-pick"'), 'Theme browser cannot sort by 17Lands pick priority');
assert.ok(html.includes('value="community-picks"'), 'Theme browser cannot sort by community picks');
assert.ok(html.includes('id="cut-colors"'), 'Cut review is missing the multi-color pool');
assert.ok(html.includes('id="type-colors"'), 'Card Types is missing the multi-color pool');
assert.ok(html.includes('id="type-function"'), 'Card Types is missing its functional-role filter');
assert.ok(html.includes('id="card-type"'), 'All Cards is missing its card-type filter');
assert.ok(html.includes('id="card-function"'), 'All Cards is missing its functional-role filter');
assert.ok(!html.includes('id="theme-color"'), 'Legacy single-color theme filter still exists');
assert.ok(!html.includes('Attack Triggers / Saboteurs'));
assert.ok(!html.includes('Function: Win Condition'), 'Removed Win Condition tags remain in the dashboard');
assert.ok(!html.includes('<option value="win-condition">'), 'Removed Win Condition filter remains in the dashboard');
assert.ok(html.includes('color-scheme: dark'), 'Dashboard is not in dark mode');
assert.ok(html.includes('Hard Payoffs'), 'Dashboard does not explain hard payoffs');
assert.ok(html.includes('Blink means intentional exile-and-return'), 'Dashboard does not expose the narrow Blink definition');
assert.ok(html.includes('Adjacent mechanics (not Blink)'), 'Dashboard does not expose copy/self-bounce/recursion adjacency');
assert.ok(report.includes('Strict Cube Health Report'));
assert.ok(report.includes('Blink is intentionally narrow'));
assert.ok(report.includes('Official RG Precedents'));
assert.ok(report.includes('Guild Experiments'));

assert.equal(adjacency.cards.length, adjacency.pairCounts.length, 'CubeCobra adjacency matrix row count is inconsistent');
assert.ok(adjacency.cards.length >= 900, 'CubeCobra adjacency matrix has unexpectedly low current-card coverage');
assert.ok(adjacency.source.qualifyingCubes >= 100000, 'CubeCobra adjacency corpus is unexpectedly small');
assert.equal(adjacency.source.minimumCubeSize, 180);
assert.equal(adjacency.source.maximumCubeSize, 1080);
for (const row of adjacency.pairCounts) assert.equal(row.length, adjacency.cards.length, 'CubeCobra adjacency matrix is not square');

assert.equal(strictOverlapCsv.length, analysis.cube.mainboardCount);
assert.equal(experimentCsv.length, analysis.guildExperiments.length);
assert.equal(rejectedCsv.length, analysis.diagnostics.rejectedNominations.length);
assert.equal(cardCsv.length, analysis.cards.length);
assert.equal(weakCardCsv.length, analysis.cards.filter((item) => item.board === 'mainboard' && (!/\bLand\b/i.test(item.type) || item.inactiveInCubeFormat)).length);
assert.equal(analysis.weakCards.length, weakCardCsv.length);
assert.match(analysis.weaknessSummary.localPickEvidence, /does not claim.*never picked/i);
assert.equal(analysis.typeCounts['Instant or Sorcery'], analysis.typeCounts.Instant + analysis.typeCounts.Sorcery, 'Instant and sorcery census is inconsistent');
for (const label of ['Interaction', 'Value']) assert.ok(analysis.functionCounts[label] > 0, `${label} function census is empty`);
assert.ok(!Object.hasOwn(analysis.functionCounts, 'Win Condition'), 'Removed Win Condition census remains in analysis');
assert.ok(!analysis.cards.some((item) => item.functionRoles.some((role) => role.id === 'win-condition')), 'Removed Win Condition role remains assigned');
assert.ok(!proposal.cards.some((item) => item.tags.includes('Function: Win Condition')), 'Removed Win Condition tag remains in the live proposal');
for (const name of ['All That Glitters', 'Eidolon of Blossoms', 'Sanctum Weaver', 'Setessan Champion']) {
  assert.ok(!analysis.cards.some((item) => item.board === 'mainboard' && item.name === name), `${name} returned after its verified live removal`);
  assert.ok(analysis.appliedOwnerCuts.some((item) => item.toLowerCase() === name.toLowerCase()), `${name} is missing from the applied owner-cut record`);
}
for (const name of ['Brazen Borrower', 'Nadu, Winged Wisdom', 'Ledger Shredder', 'Dark Confidant', 'Giver of Runes']) {
  assert.equal(card(name).weakness.reviewTier, 'Protected', `${name} was falsely promoted to a cut candidate solely for lacking a strict home`);
}
for (const name of ['Agent of the Iron Throne', 'Arcane Signet', 'Path of Ancestry']) {
  assert.equal(card(name).hasCubeOverride, true, `${name} is missing its sharpied cube rules`);
  assert.equal(card(name).inactiveInCubeFormat, false, `${name} was falsely disabled by its printed Commander text`);
  assert.notEqual(card(name).weakness?.reviewTier, 'Likely cut', `${name} is still a likely cut because of text that was sharpied away`);
}
assert.equal(card('Agent of the Iron Throne').cubeOracleText, 'Whenever an artifact or creature you control is put into a graveyard from the battlefield, each opponent loses 1 life.');
assert.equal(card('Arcane Signet').cubeOracleText, '{T}: Add one mana of any color.');
assert.match(card('Path of Ancestry').cubeOracleText, /enters tapped[\s\S]*Add one mana of any color/i);
assert.ok(card('Swords to Plowshares').functionRoles.some((role) => role.id === 'interaction'), 'Swords to Plowshares is missing Interaction');
assert.ok(card('Wall of Omens').functionRoles.some((role) => role.id === 'value'), 'Wall of Omens is missing Value');
assert.equal(card('Vial Smasher the Fierce').inactiveInCubeFormat, false, 'Vial Smasher was disabled even though its damage ability works outside Commander');

const lowEloFixture = structuredClone(card('Wall of Omens'));
const highEloFixture = structuredClone(card('Wall of Omens'));
lowEloFixture.index = 900001;
lowEloFixture.elo = 100;
highEloFixture.index = 900002;
highEloFixture.elo = 3000;
const maturityQuality = classifyCardQuality([lowEloFixture, highEloFixture]);
const lowEloQuality = maturityQuality.get(`${lowEloFixture.board}:${lowEloFixture.index}`);
const highEloQuality = maturityQuality.get(`${highEloFixture.board}:${highEloFixture.index}`);
assert.equal(lowEloQuality.mechanicalScore, highEloQuality.mechanicalScore, 'Mechanical card quality changes with community ELO');
assert.equal(lowEloQuality.mechanicalGoodOnOwn, highEloQuality.mechanicalGoodOnOwn, 'Maturity-safe standalone status changes with community ELO');
assert.notEqual(lowEloQuality.score, highEloQuality.score, 'ELO invariance fixture is not exercising the community score input');

const verification = {
  verified: true,
  contract: 'strict-v2',
  generatedAt: analysis.generatedAt,
  cubeVersion: analysis.cube.version,
  proposalDigest,
  semanticFixtures: new Set(semanticExpectations.map(([name]) => name)).size,
  semanticAssertions: semanticExpectations.length,
  cards: analysis.cards.length,
  strictThemes: analysis.themes.length,
  averageThemesPerCard: analysis.overlapDistribution.averageThemesPerCard,
};
await fs.writeFile(path.join(root, 'outputs', 'semantic-verification.json'), `${JSON.stringify(verification, null, 2)}\n`);
console.log(JSON.stringify(verification, null, 2));
