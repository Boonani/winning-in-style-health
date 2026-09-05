import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRICT_THEMES, normalizeCard, strictRoleMatches } from './taxonomy.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw/cube.json', import.meta.url)));
const frozen = JSON.parse(fs.readFileSync(new URL('./reviewed-card-fixtures.json', import.meta.url)));
// Expectations come from the printed abilities, independently of generated tags.
const cases = [
  ['Agent Bishop, Man in Black', 'pp-counters', 'enablers', true],
  ['Bilbo, Luckwearer', 'discard', 'enablers', true],
  ['Bilbo, Luckwearer', 'theft', 'enablers', true],
  ['Lockjaw, Slobbering Teleporter', 'noncreature-spells', 'payoffs', true],
  ['Lockjaw, Slobbering Teleporter', 'blink', 'enablers', false],
  ['Skycoach Conductor', 'blink', 'enablers', true],
  ['Skycoach Conductor', 'blink', 'payoffs', true],
  ['Emeritus of Ideation', 'draw-matters', 'enablers', true],
  ['Emeritus of Ideation', 'blink', 'payoffs', true],
  ['Emeritus of Ideation', 'graveyard-casting', 'payoffs', false],
  ['Monstrosity of the Lake', 'blink', 'payoffs', true],
  ['Monstrosity of the Lake', 'discard', 'enablers', true],
  ['Command the Chaff', 'opponent-cards', 'enablers', true],
  ['Show and Tell', 'blink', 'enablers', false],
  ["Aminatou's Augury", 'landfall', 'enablers', true],
  ['Guildsworn Prowler', 'dies', 'enablers', true],
  ['Arcane Omens', 'five-color-domain', 'payoffs', true],
  ['Breach the Multiverse', 'reanimator', 'payoffs', true],
  ['Breach the Multiverse', 'blink', 'enablers', false],
  ['Dismissive Pyromancer', 'discard', 'enablers', true],
  ['Blazing Firesinger', 'blink', 'payoffs', true],
  ['Blazing Firesinger', 'ramp', 'enablers', true],
  ['Star Athlete', 'noncombat-damage', 'enablers', true],
  ['Abomination, World Ravager', 'graveyard-casting', 'payoffs', true],
  ['Abomination, World Ravager', 'blink', 'enablers', false],
  ['Mjölnir, Hammer of Thor', 'blink', 'payoffs', true],
  ['Michelangelo, Weirdness to 11', 'pp-counters', 'payoffs', true],
  ['Tifa Lockhart', 'landfall', 'payoffs', true],
  ['Tifa Lockhart', 'blink', 'payoffs', false],
  ['Emeritus of Abundance', 'blink', 'payoffs', true],
  ['Transdimensional Bovine', 'ramp', 'enablers', true],
  ['Aurora Awakener', 'five-color-domain', 'payoffs', true],
  ['Gift of the Viper', 'pp-counters', 'enablers', true],
  ["It's Clobberin' Time!", 'power-matters', 'payoffs', true],
  ['Natural Order', 'sacrifice', 'enablers', true],
  ['Level Up', 'pp-counters', 'payoffs', true],
  ['H.E.R.B.I.E., Lovable Robot', 'noncreature-spells', 'payoffs', true],
  ['Stridehangar Automaton', 'artifacts', 'payoffs', true],
  ['Blightsteel Colossus', 'reanimator', 'payoffs', false],
  ['Panther Robot', 'artifacts', 'payoffs', true],
  ["Conjurer's Closet", 'blink', 'enablers', true],
  ["N'Yami-Class Mother Ship", 'combat-damage', 'enablers', true],
  ['Mistmeadow Vanisher', 'blink', 'enablers', true],
  ['Black Bolt, Inhuman King', 'noncreature-spells', 'payoffs', true],
  ["Gríma, Saruman's Footman", 'opponent-cards', 'enablers', true],
  ['Narfi, Betrayer King', 'reanimator', 'payoffs', true],
  ['Narfi, Betrayer King', 'blink', 'enablers', false],
  ['Ares, God of War', 'dies', 'payoffs', true],
  ['Okoye, Mighty and Adored', 'blink', 'payoffs', true],
  ['Scarlet Witch, Chaotic Avenger', 'opponent-cards', 'enablers', false],
  ['The Coming of Galactus', 'tokens', 'enablers', true],
  ['Annie Joins Up', 'blink', 'payoffs', true],
  // Your permanent entering is the trigger; affecting opponents is a valid payoff.
  // Cube Cobra uses Negan's alternate Oracle name Malik in this ability.
  ['Negan, the Cold-Blooded', 'blink', 'payoffs', true],
  ['Power Pack', 'blink', 'enablers', false],
  ['Professor Hulk', 'combat-damage', 'enablers', true],
  ['Trigger Happy', 'blink', 'enablers', false],
  ['Fight for the Throne', 'pp-counters', 'enablers', true],
  ['Fight for the Throne', 'dies', 'payoffs', false],
  ["Earth's Mightiest Heroes", 'noncreature-spells', 'enablers', true],
  ['Molecule Man', 'blink', 'enablers', false],
  ['Cloak and Dagger', 'equipment', 'enablers', true],
];
for (const [name, themeId, role, expected] of cases) test(`${name}: ${themeId}/${role} = ${expected}`, () => {
  const entry = raw.cards.mainboard.find((card) => card.details.name === name)
    ?? frozen.cards.find((card) => card.details.name === name);
  assert.ok(entry, `Missing fresh source fixture ${name}`);
  const card = normalizeCard(entry, 'mainboard');
  const theme = STRICT_THEMES.find((candidate) => candidate.id === themeId);
  assert.ok(theme, `Missing theme ${themeId}`);
  assert.equal(strictRoleMatches(theme, card).some((match) => match.role === role), expected, `${name}\n${card.oracleText}`);
});
