import test from 'node:test';
import assert from 'node:assert/strict';
import { tagsFromRawEntry, verifyRawTagSemantics } from './raw-tag-verification.mjs';
const setup = () => {
  const entry = { index: 2, cardID: 'wall', tags: ['Personal: favorite', 'Strict Blink: Glue'], details: { name: 'Wall of Omens', type: 'Creature — Wall', oracle_text: 'Defender\nWhen this creature enters, draw a card.', color_identity: ['W'], cmc: 2, power: '0', toughness: '4', keywords: ['Defender'] } };
  const snapshot = { cards: { mainboard: [entry], maybeboard: [], basics: [] } };
  const proposal = { cards: [{ name: 'Wall of Omens', board: 'mainboard', index: 2, cardID: 'wall', tags: tagsFromRawEntry(entry, 'mainboard', false) }] };
  return { snapshot, proposal };
};

test('recomputes from raw text while preserving personal tags and cleaning obsolete managed tags', () => {
  const { snapshot, proposal } = setup();
  assert.ok(proposal.cards[0].tags.includes('Personal: favorite'));
  assert.ok(!proposal.cards[0].tags.includes('Strict Blink: Glue'));
  assert.deepEqual(verifyRawTagSemantics(proposal, snapshot), { rawVerifiedCards: 1 });
});
for (const [name, mutate] of [
  ['fabricated role', (p) => p.cards[0].tags.push('Strict Landfall: Enabler')],
  ['omitted roles', (p) => { p.cards[0].tags = ['Personal: favorite']; }],
  ['personal tag removal', (p) => { p.cards[0].tags = p.cards[0].tags.filter((x) => !x.startsWith('Personal:')); }],
  ['missing maybeboard', (p, s) => { s.cards.maybeboard = [{ ...s.cards.mainboard[0], index: 3 }]; }],
  ['changed Oracle text', (p, s) => { s.cards.mainboard[0].details.oracle_text = 'Defender'; }],
]) test(`reject ${name} despite otherwise matching artifacts`, () => {
  const { snapshot, proposal } = setup(); mutate(proposal, snapshot);
  assert.throws(() => verifyRawTagSemantics(proposal, snapshot));
});
