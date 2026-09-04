import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeCard, STRICT_THEMES, strictRoleMatches } from './taxonomy.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw/cube.json', import.meta.url)));
const frozen = JSON.parse(fs.readFileSync(new URL('./reviewed-card-fixtures.json', import.meta.url)));
const theme = STRICT_THEMES.find((item) => item.id === 'blink');
for (const [name, oracleText, expected] of [
  ['Comma-bearing Oracle alias', 'When Alias, Grim Manipulator enters, destroy target creature an opponent controls, then draw a card.', true],
  ['Cast replacement is not an entry trigger', 'When you next cast a creature spell this turn, that creature enters with an additional +1/+1 counter on it.', false],
]) test(name, () => {
  const card = normalizeCard({ index: 0, cardID: 'synthetic', details: { name, type: 'Creature - Human', oracle_text: oracleText, power: '2', toughness: '2' } }, 'fixture');
  assert.equal(strictRoleMatches(theme, card).some((match) => match.role === 'payoffs'), expected, oracleText);
});
for (const [name, role, expected] of [
  ['Soulherder', 'payoffs', true],
  ['Tokka & Rahzar, Unsupervised', 'payoffs', true],
  ['The Coming of Galactus', 'payoffs', true],
  ['Summon: Bahamut', 'payoffs', true],
  ['Fable of the Mirror-Breaker', 'payoffs', true],
  ['Fable of the Mirror-Breaker', 'enablers', false],
  ['Reanimate', 'enablers', false],
  ["Yawgmoth's Will", 'enablers', false],
  ['Icetill Explorer', 'enablers', false],
]) test(`${name}: Blink ${role} = ${expected}`, () => {
  const entry = raw.cards.mainboard.find((card) => card.details.name === name)
    ?? frozen.cards.find((card) => card.details.name === name);
  assert.ok(entry, `Missing fresh fixture ${name}`);
  const card = normalizeCard(entry, 'mainboard');
  assert.equal(strictRoleMatches(theme, card).some((match) => match.role === role), expected, card.oracleText);
});
