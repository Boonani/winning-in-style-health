import assert from 'node:assert/strict';
import test from 'node:test';
import { renderDraftPrimer } from './draft-primer.mjs';
import DEFAULT_PRIMER_CONTENT from './fixtures/primer-content.json' with { type: 'json' };
import { scryfallImageUrl, validatePrimerContent } from './primer-content.mjs';

const clone = () => structuredClone(DEFAULT_PRIMER_CONTENT);

test('primer keeps requested copy and owner Blink prose blank', () => {
  const html = renderDraftPrimer({ cube: { version: 558 } }, clone());
  assert.equal((html.match(/Games are often won based on who is able to interact more\./g) ?? []).length, 1);
  assert.doesNotMatch(html, /Take good removal highly|Blink is the heart of this cube|Payoff:|Enabler:/);
  assert.equal(DEFAULT_PRIMER_CONTENT.sections.find(section => section.id === 'blink').body[0], '');
  assert.match(html, /<div id="blink">[\s\S]*?<h2>Blink<\/h2>/);
});

test('primer escapes source text and derives only known Scryfall image URLs', () => {
  const content = clone();
  content.hero.title = '<img src=x onerror=alert(1)>';
  content.sections.find(section => section.id === 'removal').cards[0].image = 'https://example.test/unsafe.jpg';
  const checked = validatePrimerContent(content);
  assert.equal('image' in checked.sections.find(section => section.id === 'removal').cards[0], false);
  const html = renderDraftPrimer({ cube: { version: 558 } }, checked);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /example\.test|<img src=x/);
  assert.match(scryfallImageUrl('b4e9c870-23c0-413a-ae39-265f09da16d1'), /^https:\/\/cards\.scryfall\.io\/normal\//);
});

test('malformed primer data is rejected before rendering', () => {
  const malformed = clone();
  malformed.sections[0].body = 'not an array';
  assert.throws(() => validatePrimerContent(malformed), /expected an array/);
  const badCard = clone();
  badCard.plans[0].cards[0].scryfallId = '../../.git/config';
  assert.throws(() => validatePrimerContent(badCard), /Scryfall UUID/);
});

test('all primer artwork galleries are one card per row without cropping', () => {
  const html = renderDraftPrimer({ cube: { version: 558 } }, clone());
  assert.match(html, /\.card-gallery \{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /\.card-gallery \{width:100vw/);
  assert.doesNotMatch(html, /\.card-gallery[^}]*repeat\(/);
});

test('owner-authored Blink copy, changed prompts, and removed examples render without hardcoded prose', () => {
  const content = clone();
  content.sections.find(section => section.id === 'blink').body = ['Oscar wrote this paragraph.'];
  content.sections.find(section => section.id === 'removal').body = ['A new removal lesson.'];
  content.plans[0].cards = [];
  const html = renderDraftPrimer({ cube: { version: 558 } }, content);
  assert.match(html, /Oscar wrote this paragraph\./);
  assert.match(html, /A new removal lesson\./);
  assert.doesNotMatch(html, /Games are often won based on/);
});
