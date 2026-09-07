import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import DEFAULT_PRIMER_CONTENT from './fixtures/primer-content.json' with { type: 'json' };
import { createPrimerEditorServer, savePrimerContent } from './primer-editor-server.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'primer-editor-'));
  const toolingRoot = path.join(root, 'tooling');
  const siteRoot = path.join(root, 'site');
  const backupRoot = path.join(root, 'backups');
  await fs.mkdir(path.join(toolingRoot, 'data'), { recursive: true });
  await fs.mkdir(path.join(toolingRoot, 'outputs'), { recursive: true });
  await fs.mkdir(siteRoot, { recursive: true });
  await fs.writeFile(path.join(toolingRoot, 'data', 'primer-content.json'), `${JSON.stringify(DEFAULT_PRIMER_CONTENT, null, 2)}\n`);
  await fs.writeFile(path.join(toolingRoot, 'outputs', 'analysis.json'), JSON.stringify({ cube: { version: 1 } }));
  await fs.writeFile(path.join(siteRoot, 'primer.html'), '<!doctype html><title>old</title>');
  return { root, toolingRoot, siteRoot, backupRoot };
}

const request = (url, { method = 'GET', headers = {}, body = '' } = {}) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const req = http.request({ hostname: target.hostname, port: target.port, path: target.pathname + target.search, method, headers }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

test('editor API rejects malformed, cross-origin, stale, and rebound writes; save reloads durably', async t => {
  const dirs = await fixture();
  t.after(() => fs.rm(dirs.root, { recursive: true, force: true }));
  const instance = createPrimerEditorServer({ ...dirs, port: 0, publisher: { status: async () => ({ state: 'idle' }), start: async () => ({ state: 'queued' }) } });
  await new Promise((resolve, reject) => instance.server.listen(0, '127.0.0.1').once('listening', resolve).once('error', reject));
  t.after(() => new Promise(resolve => instance.server.close(resolve)));
  const origin = instance.origin;

  const loaded = await request(`${origin}/api/content`);
  assert.equal(loaded.status, 200);
  const initial = JSON.parse(loaded.body);
  assert.equal((await request(`${origin}/.git/config`)).status, 404);
  assert.equal((await request(`${origin}/src/primer-editor-server.mjs`)).status, 404);

  const crossOrigin = await request(`${origin}/api/content`, {
    method: 'PUT', headers: { Host: new URL(origin).host, Origin: 'http://evil.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(initial),
  });
  assert.equal(crossOrigin.status, 403);

  const rebound = await request(`${origin}/api/content`, {
    method: 'PUT', headers: { Host: 'evil.test', Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(initial),
  });
  assert.equal(rebound.status, 421);

  const malformed = await request(`${origin}/api/content`, {
    method: 'PUT', headers: { Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);

  initial.content.hero.title = 'Saved through the editor.';
  const saved = await request(`${origin}/api/content`, {
    method: 'PUT', headers: { Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(initial),
  });
  assert.equal(saved.status, 200);
  const savedBody = JSON.parse(saved.body);
  assert.equal(savedBody.state, 'saved-and-rendered');
  assert.notEqual(savedBody.revision, initial.revision);
  assert.match(await fs.readFile(path.join(dirs.siteRoot, 'primer.html'), 'utf8'), /Saved through the editor\./);
  assert.equal(JSON.parse((await request(`${origin}/api/content`)).body).content.hero.title, 'Saved through the editor.');
  assert.equal((await fs.readdir(dirs.backupRoot)).length, 1);

  const stale = await request(`${origin}/api/content`, {
    method: 'PUT', headers: { Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(initial),
  });
  assert.equal(stale.status, 409);
});

test('failed render leaves source and public artifact unchanged', async t => {
  const dirs = await fixture();
  t.after(() => fs.rm(dirs.root, { recursive: true, force: true }));
  const sourceFile = path.join(dirs.toolingRoot, 'data', 'primer-content.json');
  const beforeSource = await fs.readFile(sourceFile, 'utf8');
  const beforePublic = await fs.readFile(path.join(dirs.siteRoot, 'primer.html'), 'utf8');
  const revision = (await import('./primer-content.mjs')).primerRevision(beforeSource);
  await assert.rejects(savePrimerContent({
    ...dirs,
    expectedRevision: revision,
    proposedContent: structuredClone(DEFAULT_PRIMER_CONTENT),
    renderer: () => { throw new Error('synthetic render failure'); },
  }), /synthetic render failure/);
  assert.equal(await fs.readFile(sourceFile, 'utf8'), beforeSource);
  assert.equal(await fs.readFile(path.join(dirs.siteRoot, 'primer.html'), 'utf8'), beforePublic);
});

test('rebinding reads, concurrent saves, and publication share a guarded queue', async t => {
  const dirs = await fixture();
  t.after(() => fs.rm(dirs.root, { recursive: true, force: true }));
  let state = 'idle';
  const instance = createPrimerEditorServer({ ...dirs, port: 0, publisher: {
    status: async () => ({ state }),
    start: async () => ({ state: state = 'queued' }),
  } });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => instance.server.close(resolve)));
  const origin = instance.origin;
  assert.equal((await request(origin + '/api/content', { headers: { Host: 'evil.test' } })).status, 421);
  assert.equal((await request(origin + '/api/publish', { method: 'POST', headers: { Origin: 'http://evil.test' } })).status, 403);
  const initial = JSON.parse((await request(origin + '/api/content')).body);
  const write = (method, route, body) => request(origin + route, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const results = await Promise.all([write('PUT', '/api/content', initial), write('PUT', '/api/content', initial)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await write('POST', '/api/publish', initial)).status, 409);
  const current = JSON.parse((await request(origin + '/api/content')).body);
  assert.equal((await write('POST', '/api/publish', { revision: current.revision })).status, 202);
  assert.equal((await write('PUT', '/api/content', current)).status, 409);
  assert.equal(JSON.parse((await request(origin + '/api/publish')).body).state, 'queued');
});
