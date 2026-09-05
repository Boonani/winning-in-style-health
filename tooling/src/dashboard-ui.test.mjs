import assert from 'node:assert/strict';
import test from 'node:test';
import { buildThemeSupportModel, circleDiameter, filterUpdateEvents, groupUpdateEvents } from './dashboard-ui.mjs';

test('theme circles use count-proportional area on one shared scale', () => {
  const model = buildThemeSupportModel({
    cards: [
      { id: 'w', colors: ['W'] },
      { id: 'wu', colors: ['W', 'U'] },
      { id: 'c', colors: [] },
      { id: 'r', colors: ['R'] },
    ],
    themes: [
      { id: 'a', name: 'A', roleCardIds: { enablers: ['w', 'wu', 'c', 'r'], payoffs: ['w'], glue: [] } },
      { id: 'b', name: 'B', roleCardIds: { enablers: ['w', 'wu'], payoffs: [], glue: ['c'] } },
    ],
  });
  assert.equal(model.scaleMax, 4);
  assert.equal(model.themes[0].roles.enablers.diameter, 76);
  assert.equal(model.themes[1].roles.enablers.diameter, circleDiameter(2, 4));
  assert.equal(model.themes[0].roles.payoffs.diameter, 38);
  assert.equal(model.themes[0].roles.enablers.colors.W, 2);
  assert.equal(model.themes[0].roles.enablers.colors.U, 1);
  assert.equal(model.themes[0].roles.enablers.colors.C, 1);
  assert.deepEqual(model.themes[0].roles.enablers.dominantColors, ['W']);
});

test('update grouping preserves every recorded event and groups nearby dates', () => {
  const events = [{id:'a',date:'2026-09-04T12:00:00Z'},{id:'b',date:'2026-09-03T12:00:00Z'},{id:'c',date:'2026-08-04T12:00:00Z'},{id:'d',date:null}];
  const groups = groupUpdateEvents(events, 'quarter');
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].events.map(event => event.id), ['a','b']);
  assert.deepEqual(groups.flatMap(group => group.events), events);
  assert.equal(groupUpdateEvents(events, 'week').length, 4);
});

test('update windows never invent a date for undated comparisons', () => {
  const now = new Date('2026-09-04T20:00:00.000Z');
  const events = [
    { id: 'recent', date: '2026-09-01T12:00:00.000Z' },
    { id: 'older', date: '2026-07-01T12:00:00.000Z' },
    { id: 'snapshot', date: null },
  ];
  assert.deepEqual(filterUpdateEvents(events, 'week', now).map((event) => event.id), ['recent']);
  assert.deepEqual(filterUpdateEvents(events, 'quarter', now).map((event) => event.id), ['recent', 'older']);
  assert.deepEqual(filterUpdateEvents(events, 'all', now).map((event) => event.id), ['recent', 'older', 'snapshot']);
});
