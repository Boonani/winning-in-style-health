import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProposalCoverage, verifyTagOnlyCommit } from './tag-sync-guards.mjs';

const fixture = () => {
  const before = { id: 'cube', version: 555, cards: { id: 'cube', mainboard: [{ index: 2, cardID: 'a', tags: ['Personal'], status: 'Owned', notes: 'keep', details: { name: 'A' } }], maybeboard: [{ index: 7, cardID: 'b', tags: [] }], basics: [{ index: 0, cardID: 'c', tags: [] }] } };
  const proposal = { cube: { id: 'cube', version: 555 }, cards: ['mainboard', 'maybeboard', 'basics'].flatMap((board) => before.cards[board].map((card) => ({ board, index: card.index, cardID: card.cardID, tags: [...card.tags, 'Function: Test'] }))) };
  return { before, proposal, live: structuredClone(before) };
};

test('full proposal covers non-contiguous indexes across every board', () => {
  const { before, proposal, live } = fixture();
  assert.equal(validateProposalCoverage(proposal, live, before).size, 3);
});
for (const [name, mutate] of [
  ['missing board card', (p) => p.cards.pop()],
  ['duplicate position', (p) => { p.cards[2] = structuredClone(p.cards[0]); }],
  ['changed printing', (p) => { p.cards[0].cardID = 'other'; }],
  ['duplicate tags', (p) => { p.cards[0].tags.push('Personal'); }],
  ['empty tag', (p) => { p.cards[0].tags.push(' '); }],
  ['invalid index', (p) => { p.cards[0].index = '2'; }],
]) test(`reject ${name}`, () => {
  const { before, proposal, live } = fixture(); mutate(proposal);
  assert.throws(() => validateProposalCoverage(proposal, live, before));
});
for (const [name, mutate] of [
  ['concurrent tags', (c) => c.cards.mainboard[0].tags.push('new user tag')],
  ['concurrent notes', (c) => { c.cards.mainboard[0].notes = 'new'; }],
  ['new card', (c) => c.cards.basics.push({ index: 1, cardID: 'd', tags: [] })],
  ['version changed', (c) => { c.version++; }],
]) test(`reject ${name}`, () => {
  const { before, proposal, live } = fixture(); mutate(live);
  assert.throws(() => validateProposalCoverage(proposal, live, before));
});

test('ignores refreshed descriptive details but preserves all editable non-tag fields', () => {
  const { before, proposal, live } = fixture();
  live.cards.mainboard[0].details = { name: 'A', elo: 1200 };
  assert.equal(validateProposalCoverage(proposal, live, before).size, 3);
  live.version++;
  for (const card of proposal.cards) live.cards[card.board].find((c) => c.index === card.index).tags = card.tags;
  assert.deepEqual(verifyTagOnlyCommit(before, live, proposal, 556), { verifiedCards: 3, tagMismatches: 0, nonTagMismatches: 0 });
  live.cards.mainboard[0].status = 'Not Owned';
  assert.throws(() => verifyTagOnlyCommit(before, live, proposal, 556), /Non-tag/);
});

test('post-commit detection covers added boards, cards, altered tags, and version drift', () => {
  const { before, proposal, live } = fixture();
  live.version++;
  for (const card of proposal.cards) live.cards[card.board].find((c) => c.index === card.index).tags = card.tags;
  for (const mutate of [
    (c) => { c.cards.extra = []; },
    (c) => c.cards.basics.pop(),
    (c) => { c.cards.mainboard[0].tags = []; },
    (c) => { c.version++; },
  ]) {
    const altered = structuredClone(live); mutate(altered);
    assert.throws(() => verifyTagOnlyCommit(before, altered, proposal, 556));
  }
});
