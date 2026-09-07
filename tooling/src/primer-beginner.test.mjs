import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRIMER_CONTENT, renderDraftPrimer, renderCubeCobraPrimer, PRIMER_REDIRECT, PRACTICE_URL } from './draft-primer.mjs';
import { validatePrimerContent } from './primer-content.mjs';
test('beginner research governs the published lesson and exact practice action', () => {
  const html = renderDraftPrimer({cube:{version:558}});
  assert.match(html, /Fixing gives you permission to play more colors/);
  assert.doesNotMatch(html, /15 creatures|8 other spells|Start with two colors|who is able to interact more/);
  assert.match(html, /23 nonlands/);
  assert.match(html, /Illustrative curve, not quotas/);
  assert.match(html, /Practice drafting against bots and have fun!/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.equal(new URL(PRACTICE_URL).searchParams.get('cubeCobraID'), '1fd964c1-9092-46f8-8188-5e933e12e190');
  assert.equal(new URL(PRACTICE_URL).searchParams.get('cubeCobraName'), '\u2728 Winning in Style \u2728 ');
  assert.match(html, /<details id="explore-strategies">/);
  assert.doesNotMatch(html, /<details open/);
  assert.match(html, /Five-color good stuff/);
  assert.match(renderCubeCobraPrimer({cube:{version:558}}), /https:\/\/cube.coolasheck.com\/primer/);
  assert.match(PRIMER_REDIRECT, /location.search\+location.hash/);
});
test('new lessons and multicolor metadata survive editor validation', () => {
  const copy = structuredClone(DEFAULT_PRIMER_CONTENT);
  const validated = validatePrimerContent(copy);
  for (const id of ['mana','mana-detail','finish','plan-lesson','mana-example','deck-example'])
    assert.deepEqual(validated.sections.find(s => s.id === id), copy.sections.find(s => s.id === id));
  assert.equal(validated.plans.length, 11);
  copy.plans.at(-1).colors = ['W','W','B','R','G'];
  assert.throws(() => validatePrimerContent(copy), /colors must match/);
});
