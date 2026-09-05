import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { STRICT_THEMES, normalizeCard, strictRoleMatches } from './taxonomy.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw/cube.json', import.meta.url)));
const cards = Object.entries(raw.cards).flatMap(([board, list]) => Array.isArray(list) ? list.map((c) => normalizeCard(c, board)) : []);
const card = (name) => { const found = cards.find((c) => c.name === name); assert.ok(found, name); return found; };
const assigned = (c, theme, role) => strictRoleMatches(STRICT_THEMES.find((t) => t.id === theme), c).some((r) => r.role === role);
const fixtures = [
  ['Yawgmoth, Thran Physician', 'dies', 'payoffs', true], ['Yawgmoth, Thran Physician', 'dies', 'enablers', false],
  ['Diabolic Intent', 'dies', 'payoffs', true], ['Natural Order', 'dies', 'payoffs', true],
  ['Legion Extruder', 'dies', 'payoffs', false], ['Legion Extruder', 'dies', 'enablers', false],
  ['Blood Artist', 'dies', 'payoffs', true], ['Bitterblossom', 'dies', 'enablers', true],
  ['Guildsworn Prowler', 'dies', 'enablers', true], ['Guildsworn Prowler', 'dies', 'payoffs', false],
  ['Lurrus of the Dream-Den', 'dies', 'enablers', false], ['Cosmogrand Zenith', 'dies', 'enablers', false],
  ['Marionette Apprentice', 'dies', 'enablers', true], ['Ares, God of War', 'dies', 'payoffs', true],
  ['Surrak, Elusive Hunter', 'power-four', 'enablers', true], ['Surrak, Elusive Hunter', 'power-matters', 'enablers', true],
  ['Emrakul, the Aeons Torn', 'power-four', 'enablers', false], ['Emrakul, the Promised End', 'power-matters', 'enablers', false],
  ["Uro, Titan of Nature's Wrath", 'power-four', 'enablers', false], ['The Warring Triad', 'power-four', 'enablers', false],
  ['Nishoba Brawler', 'power-matters', 'enablers', true], ['Nishoba Brawler', 'power-four', 'enablers', false],
];
for (const [name, theme, role, expected] of fixtures) test(`${name}: strategic ${theme}/${role}`, () => assert.equal(assigned(card(name), theme, role), expected));
const synthetic = (text, values = {}) => ({ ...card('Surrak, Elusive Hunter'), name: 'Regression fixture', oracleText: text, keywords: [], oracleTags: [], ...values });
test('generic creatures are not Aristocrats support', () => assert.deepEqual(strictRoleMatches(STRICT_THEMES.find((t) => t.id === 'dies'), synthetic('Vigilance')), []));
test('Professional Facebreaker Treasure outlet is not creature sacrifice', () => {
  const c = synthetic('Whenever one or more creatures you control deal combat damage to a player, create a Treasure token.\nSacrifice a Treasure: Exile the top card of your library. You may play that card this turn.');
  assert.deepEqual(strictRoleMatches(STRICT_THEMES.find((t) => t.id === 'dies'), c), []);
});
test('expensive or conditional four-power tokens do not inflate early support', () => {
  for (const [text, cmc] of [['Create a 4/4 green Beast creature token.', 5], ['{5}: Create a 4/4 green Beast creature token.', 2], ['Whenever this creature attacks, create a 4/4 green Beast creature token.', 3]]) assert.equal(assigned(synthetic(text, { type: 'Enchantment', power: '', cmc }), 'power-four', 'enablers'), false);
});
test('early unconditional token spell qualifies', () => assert.equal(assigned(synthetic('Create a 4/4 green Beast creature token.', { type: 'Sorcery', power: '', cmc: 3 }), 'power-four', 'enablers'), true));
