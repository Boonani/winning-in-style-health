import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const deployRoot = path.resolve(root, process.env.DASHBOARD_DEPLOY_DIR ?? 'deploy-site');
const origin = new URL(process.env.DASHBOARD_PUBLIC_URL ?? 'https://cube.coolasheck.com/');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function assetsBelow(relative) {
  const entries = await fs.readdir(path.join(deployRoot, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = relative + '/' + entry.name;
    if (entry.isDirectory()) files.push(...await assetsBelow(next));
    else if (/\.(svg|png|jpe?g|webp|js|css|json|pdf|woff2)$/.test(entry.name)) files.push(next);
  }
  return files;
}
const files = ['index.html', 'primer.html', 'draft-primer.html', 'data/cubecobra-adjacency.json', ...await assetsBelow('assets'), ...await assetsBelow('print')].sort();
const receipts = [];
for (const relative of files) {
  const url = new URL(relative === 'index.html' ? './' : relative === 'primer.html' ? 'primer' : relative, origin);
  url.searchParams.set('verification', String(Date.now()));
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'Cache-Control': 'no-cache' } });
  assert.equal(response.status, 200, `${relative}: HTTP ${response.status}`);
  const remote = Buffer.from(await response.arrayBuffer());
  const local = await fs.readFile(path.join(deployRoot, relative));
  assert.equal(hash(remote), hash(local), `${relative}: public content differs from tested build`);
  receipts.push({ file: relative, bytes: local.length, sha256: hash(local), url: response.url, status: response.status });
}
const analysis = JSON.parse(await fs.readFile(path.join(root, 'outputs', 'analysis.json'), 'utf8'));
const receipt = { verified: true, checkedAt: new Date().toISOString(), publicUrl: origin.href, cubeVersion: analysis.cube.version, mainboard: analysis.cube.mainboardCount, files: receipts };
await fs.writeFile(path.join(root, 'outputs', 'public-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
