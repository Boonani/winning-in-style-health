import fs from 'node:fs/promises';
import path from 'node:path';
import { buildUpdateHistory } from './update-history.mjs';
const root = path.resolve(import.meta.dirname, '..');
const cubeId = '1fd964c1-9092-46f8-8188-5e933e12e190';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(route, body) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://cubecobra.com${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) { await pause(1000 * 2 ** attempt); continue; }
        throw new Error(`${route}: HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.success !== 'true') throw new Error(`${route}: unsuccessful response`);
      return result;
    } catch (error) {
      if (attempt >= 2 || (!/fetch failed|timeout|aborted/i.test(error.message))) throw error;
      await pause(1000 * 2 ** attempt);
    }
  }
}
const posts = [];
let lastKey = null;
const cursors = new Set();
for (let page = 0; page < 100; page += 1) {
  const result = await request('/cube/getmorechangelogs', { cubeId, lastKey });
  posts.push(...result.posts);
  console.log(`History page ${page + 1}: ${result.posts.length} records`);
  lastKey = result.lastKey;
  if (!lastKey) break;
  const key = JSON.stringify(lastKey);
  if (cursors.has(key)) throw new Error('History pagination repeated a cursor');
  cursors.add(key);
  if (page === 99) throw new Error('History pagination exceeded limit; refusing to claim full coverage');
  await pause(200);
}
const details = {};
for (const file of ['cube.json', 'previous-cube.json']) {
  const raw = JSON.parse(await fs.readFile(path.join(root, 'data/raw', file), 'utf8'));
  for (const list of Object.values(raw.cards)) if (Array.isArray(list)) for (const c of list) if (c.details?.name) details[c.cardID] = c.details;
}
const ids = new Set();
for (const p of posts) {
  const c = p.changelog?.mainboard;
  if (!c) continue;
  for (const e of c.adds ?? []) ids.add(e.cardID);
  for (const e of c.removes ?? []) ids.add((e.oldCard ?? e).cardID);
  for (const e of [...(c.swaps ?? []), ...(c.edits ?? [])]) {
    const next = e.card ?? e.newCard;
    if (next?.cardID !== e.oldCard?.cardID) { ids.add(next?.cardID); ids.add(e.oldCard?.cardID); }
  }
}
ids.delete(undefined);
const missing = [...ids].filter((id) => !details[id]);
for (let i = 0; i < missing.length; i += 100) {
  const batch = missing.slice(i, i + 100);
  const result = await request('/cube/api/getdetailsforcards', { cards: batch });
  if (result.details.length !== batch.length) throw new Error('Card detail batch length mismatch');
  batch.forEach((id, n) => { details[id] = result.details[n]; });
  console.log(`Resolved history cards ${Math.min(i + 100, missing.length)}/${missing.length}`);
  await pause(200);
}
const timestamps = posts.map((p) => Number(p.date)).filter(Number.isFinite);
const history = buildUpdateHistory(posts, details, {
  from: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
  to: new Date().toISOString(), complete: !lastKey, records: posts.length,
  note: 'All available Cube Cobra changelog records. Mainboard only. Replacements are recorded swaps, not inferred pairs; tag-only and printing-only edits are omitted.',
});
await fs.mkdir(path.join(root, 'data/history'), { recursive: true });
await fs.writeFile(path.join(root, 'data/history/cube-history.json'), JSON.stringify(history, null, 2) + '\n');
console.log(JSON.stringify({ events: history.events.length, coverage: history.coverage, additions: history.events.reduce((n,e)=>n+e.added.length,0), removals: history.events.reduce((n,e)=>n+e.removed.length,0), replacements: history.events.reduce((n,e)=>n+e.replacements.length,0) }));
