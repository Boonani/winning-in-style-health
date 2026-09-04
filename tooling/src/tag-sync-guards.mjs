import assert from 'node:assert/strict';

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const signature = (value) => JSON.stringify(canonical(value));
const keyOf = (board, index) => `${board}:${index}`;
const sameTags = (a = [], b = []) => signature([...a].sort()) === signature([...b].sort());
const nonTagFields = ({ details, tags, ...entry }) => entry;

export function validateProposalCoverage(proposal, live, snapshot) {
  assert.equal(live.id, proposal.cube.id, 'Live cube identity differs from proposal');
  assert.equal(live.version, proposal.cube.version, 'Live cube version differs from proposal');
  assert.equal(snapshot.id, live.id, 'Source cube identity differs from live');
  assert.equal(snapshot.version, live.version, 'Source cube version differs from live');
  const liveEntries = new Map();
  for (const [board, cards] of Object.entries(live.cards)) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      assert.ok(Number.isSafeInteger(Number(card.index)) && Number(card.index) >= 0, `Invalid live index in ${board}`);
      const key = keyOf(board, Number(card.index));
      assert.ok(!liveEntries.has(key), `Duplicate live position ${key}`);
      liveEntries.set(key, card);
    }
  }
  assert.equal(proposal.cards.length, liveEntries.size, 'Proposal must cover every live card on every board');
  const seen = new Set();
  for (const card of proposal.cards) {
    assert.ok(Number.isSafeInteger(card.index) && card.index >= 0, 'Invalid proposal index');
    const key = keyOf(card.board, card.index);
    assert.ok(!seen.has(key), `Duplicate proposal position ${key}`);
    seen.add(key);
    const current = liveEntries.get(key);
    assert.ok(current, `Missing live card ${key}`);
    assert.equal(card.cardID, current.cardID, `Printing changed at ${key}`);
    assert.ok(Array.isArray(card.tags) && card.tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0), `Invalid tags at ${key}`);
    assert.equal(new Set(card.tags).size, card.tags.length, `Duplicate tags at ${key}`);
    const original = snapshot.cards?.[card.board]?.find((entry) => Number(entry.index) === card.index);
    assert.ok(original, `Missing source card ${key}`);
    assert.equal(signature(nonTagFields(original)), signature(nonTagFields(current)), `Live non-tag fields changed at ${key}`);
    assert.ok(sameTags(original.tags, current.tags), `Live tags changed since analysis at ${key}`);
  }
  return liveEntries;
}

export function verifyTagOnlyCommit(before, after, proposal, committedVersion) {
  assert.equal(after.id, before.id, 'Post-commit cube identity changed');
  assert.equal(after.version, committedVersion, 'Post-commit version differs from committed version');
  const boardNames = (cube) => Object.keys(cube.cards).filter((board) => Array.isArray(cube.cards[board])).sort();
  assert.deepEqual(boardNames(after), boardNames(before), 'Card boards changed during tag commit');
  const proposed = new Map(proposal.cards.map((card) => [keyOf(card.board, card.index), card]));
  for (const board of boardNames(before)) {
    assert.equal(after.cards[board].length, before.cards[board].length, `Card count changed on ${board}`);
    const indexes = new Set(after.cards[board].map((card) => Number(card.index)));
    assert.equal(indexes.size, after.cards[board].length, `Duplicate post-commit positions on ${board}`);
    for (const original of before.cards[board]) {
      const key = keyOf(board, Number(original.index));
      const current = after.cards[board].find((card) => Number(card.index) === Number(original.index));
      assert.ok(current, `Card disappeared at ${key}`);
      assert.equal(signature(nonTagFields(current)), signature(nonTagFields(original)), `Non-tag properties changed at ${key}`);
      assert.ok(proposed.has(key), `Unreviewed card at ${key}`);
      assert.ok(sameTags(current.tags, proposed.get(key).tags), `Post-commit tags differ at ${key}`);
    }
  }
  return { verifiedCards: proposed.size, tagMismatches: 0, nonTagMismatches: 0 };
}
