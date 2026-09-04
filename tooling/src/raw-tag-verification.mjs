import assert from 'node:assert/strict';
import { STRICT_THEMES, normalizeCard, strictRoleMatches, functionalRoleMatches, taxonomyHelpers } from './taxonomy.mjs';

// These are the namespaces owned by the legacy writer, not arbitrary personal tags.
export const managedTagPrefixes = [
  'Blink:', 'Theft:', 'Artifact Sac:', 'Big Mana:', 'GW Growth:', 'Aristocrats:', 'Noncombat Damage:',
  'Graveyard:', 'Humans:', 'Counters:', 'Stax:', 'Control:', 'Black Aggro:', 'Red Aggro:', 'Chonkers:',
  'Strict ', 'Function:',
];

export function tagsFromRawEntry(entry, board, cubeUsesCommanders) {
  const card = normalizeCard(entry, board);
  card.inactiveInCubeFormat = !cubeUsesCommanders && taxonomyHelpers.isCommanderOnly(card);
  const tags = card.existingTags.filter((tag) => !managedTagPrefixes.some((prefix) => tag.startsWith(prefix)));
  for (const theme of STRICT_THEMES) for (const match of strictRoleMatches(theme, card)) tags.push(match.liveTag);
  for (const match of functionalRoleMatches(card)) tags.push(match.liveTag);
  return [...new Set(tags)].sort();
}

export function verifyRawTagSemantics(proposal, snapshot) {
  const formatText = `${JSON.stringify(snapshot.formats ?? [])}\n${snapshot.description ?? ''}`;
  const cubeUsesCommanders = /commander draft|command zone|designat(?:e|es|ed|ing) [^.\n]{0,40}commander/i.test(formatText);
  const cards = new Map();
  for (const [board, entries] of Object.entries(snapshot.cards)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const key = `${board}:${Number(entry.index)}`;
      assert.ok(!cards.has(key), `Duplicate source card ${key}`);
      cards.set(key, { entry, board });
    }
  }
  assert.equal(proposal.cards.length, cards.size, 'Semantic proposal coverage differs from raw cube');
  const seen = new Set();
  for (const proposed of proposal.cards) {
    const key = `${proposed.board}:${proposed.index}`;
    assert.ok(!seen.has(key), `Duplicate semantic proposal ${key}`);
    seen.add(key);
    const source = cards.get(key);
    assert.ok(source, `Proposal has no raw source at ${key}`);
    assert.equal(proposed.cardID, source.entry.cardID, `Raw printing differs at ${key}`);
    const expected = tagsFromRawEntry(source.entry, source.board, cubeUsesCommanders);
    assert.deepEqual([...proposed.tags].sort(), expected, `Proposal differs from current rules applied to raw source at ${key} (${proposed.name})`);
  }
  return { rawVerifiedCards: cards.size };
}
