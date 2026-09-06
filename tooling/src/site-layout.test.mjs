import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const dashboard = fs.readFileSync(path.join(import.meta.dirname, 'dashboard.mjs'), 'utf8');
const designed = fs.readFileSync(path.join(import.meta.dirname, 'designed-ui.mjs'), 'utf8');

test('dashboard card, candidate, history, replacement, and packet galleries stay single-column', () => {
  for (const selector of ['.card-gallery', '.candidate-gallery', '.change-cards', '.replacement-list', '.packet-cards']) {
    const escaped = selector.replace('.', '\\.');
    assert.match(dashboard, new RegExp(`${escaped} \\{[^}]*grid-template-columns: minmax\\(0, 1fr\\)`), selector);
  }
  assert.match(dashboard, /\.replacement \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(dashboard, /\.change-cards \{[^}]*repeat\(|\.replacement-list \{[^}]*repeat\(/);
});

test('dashboard and designed card artwork is uncropped and has no applied radius', () => {
  assert.match(dashboard, /\.card-tile img[^}]*object-fit: contain[^}]*border-radius: 0/);
  assert.match(dashboard, /\.candidate img[^}]*object-fit: contain[^}]*border-radius: 0/);
  assert.match(dashboard, /\.change-card img[^}]*object-fit: contain[^}]*border-radius: 0/);
  assert.match(designed, /\.design-gallery \{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(designed, /\.design-card img \{[^}]*object-fit:contain[^}]*border-radius:0/);
});
