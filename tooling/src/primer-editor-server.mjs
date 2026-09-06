import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDraftPrimer } from './draft-primer.mjs';
import { createPrimerPublisher } from './primer-publish.mjs';
import {
  loadPrimerContent,
  primerRevision,
  SCRYFALL_IMAGE_HOST,
  serializePrimerContent,
  validatePrimerContent,
} from './primer-content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOOLING_ROOT = path.resolve(here, '..');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8768;
const MAX_BODY = 2 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (response, status, value) => {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
};

async function requestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
}

async function atomicWrite(file, contents, mode = 0o644) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, contents, { flag: 'wx', mode });
  try { await fs.rename(temporary, file); }
  catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function savePrimerContent({
  toolingRoot = DEFAULT_TOOLING_ROOT,
  siteRoot = path.resolve(toolingRoot, '..'),
  backupRoot = '/home/boon/state/cube-site-20260905/primer-backups',
  expectedRevision,
  proposedContent,
  now = new Date(),
  renderer = renderDraftPrimer,
}) {
  if (typeof expectedRevision !== 'string' || !/^[0-9a-f]{64}$/.test(expectedRevision)) {
    throw new HttpError(400, 'A valid base revision is required.');
  }
  const sourceFile = path.join(toolingRoot, 'data', 'primer-content.json');
  const analysisFile = path.join(toolingRoot, 'outputs', 'analysis.json');
  const publicFile = path.join(siteRoot, 'draft-primer.html');
  const current = await loadPrimerContent(sourceFile);
  if (current.revision !== expectedRevision) throw new HttpError(409, 'The primer changed after you loaded it. Reload before saving.');

  const checked = validatePrimerContent(proposedContent);
  checked.documentVersion = current.content.documentVersion + 1;
  checked.updatedAt = now.toISOString();
  const serialized = serializePrimerContent(checked);
  const analysis = JSON.parse(await fs.readFile(analysisFile, 'utf8'));
  const rendered = renderer(analysis, checked);
  if (typeof rendered !== 'string' || !rendered.startsWith('<!doctype html>') || rendered.length < 5000) {
    throw new Error('Primer render failed its artifact sanity check.');
  }

  const previousPublic = await fs.readFile(publicFile).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  await fs.mkdir(backupRoot, { recursive: true, mode: 0o700 });
  const stamp = now.toISOString().replaceAll(':', '-');
  const backupFile = path.join(backupRoot, `${stamp}-${current.revision.slice(0, 12)}.json`);
  await fs.writeFile(backupFile, current.serialized, { flag: 'wx', mode: 0o600 });

  let sourceChanged = false;
  let publicChanged = false;
  try {
    await atomicWrite(sourceFile, serialized);
    sourceChanged = true;
    await atomicWrite(publicFile, rendered);
    publicChanged = true;
  } catch (error) {
    if (publicChanged && previousPublic !== null) await atomicWrite(publicFile, previousPublic).catch(() => {});
    if (sourceChanged) await atomicWrite(sourceFile, current.serialized).catch(() => {});
    throw error;
  }

  return {
    content: checked,
    revision: primerRevision(serialized),
    backupFile,
    publicFile,
  };
}

export async function searchScryfallPrintings(name, fetchImpl = fetch) {
  const query = String(name ?? '').trim();
  if (query.length < 2 || query.length > 160 || /["\n\r]/.test(query)) throw new HttpError(400, 'Enter an exact card name.');
  const url = new URL('https://api.scryfall.com/cards/search');
  url.searchParams.set('q', `!"${query}" lang:en game:paper`);
  url.searchParams.set('unique', 'prints');
  url.searchParams.set('order', 'released');
  url.searchParams.set('dir', 'desc');
  const result = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'WinningInStylePrimerEditor/1.0' }, signal: AbortSignal.timeout(20000) });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) throw new HttpError(result.status === 404 ? 404 : 502, body.details || 'Scryfall lookup failed.');
  const printings = (body.data ?? []).filter(card => {
    const image = card.image_uris?.normal;
    if (card.lang !== 'en' || card.layout !== 'normal' || card.textless || !card.oracle_text || !image) return false;
    try {
      const parsed = new URL(image);
      return parsed.protocol === 'https:' && parsed.hostname === SCRYFALL_IMAGE_HOST;
    } catch { return false; }
  }).map(card => ({
    scryfallId: card.id,
    name: card.name,
    set: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    releasedAt: card.released_at,
    oracleText: card.oracle_text,
    image: card.image_uris.normal,
    scryfallUri: card.scryfall_uri,
    recommended: !card.promo && !card.full_art && card.border_color !== 'borderless',
  }));
  printings.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.releasedAt.localeCompare(a.releasedAt));
  return printings;
}

function safeStaticMap(toolingRoot, siteRoot) {
  const map = new Map([
    ['/', [path.join(toolingRoot, 'editor.html'), 'text/html; charset=utf-8']],
    ['/stats.html', [path.join(toolingRoot, 'picks', 'stats.html'), 'text/html; charset=utf-8']],
    ['/assets/pick-stats.js', [path.join(toolingRoot, 'picks', 'stats.js'), 'text/javascript; charset=utf-8']],
    ['/assets/pick-stats.css', [path.join(toolingRoot, 'picks', 'stats.css'), 'text/css; charset=utf-8']],
    ['/editor.html', [path.join(toolingRoot, 'editor.html'), 'text/html; charset=utf-8']],
    ['/assets/editor.css', [path.join(toolingRoot, 'assets', 'editor.css'), 'text/css; charset=utf-8']],
    ['/assets/editor.js', [path.join(toolingRoot, 'assets', 'editor.js'), 'text/javascript; charset=utf-8']],
    ['/preview/', [path.join(siteRoot, 'index.html'), 'text/html; charset=utf-8']],
    ['/preview/index.html', [path.join(siteRoot, 'index.html'), 'text/html; charset=utf-8']],
    ['/preview/draft-primer.html', [path.join(siteRoot, 'draft-primer.html'), 'text/html; charset=utf-8']],
    ['/preview/data/cubecobra-adjacency.json', [path.join(siteRoot, 'data', 'cubecobra-adjacency.json'), 'application/json; charset=utf-8']],
  ]);
  for (const icon of ['arrow-up', 'arrow-down', 'trash-2', 'plus', 'save', 'refresh-cw', 'search', 'move-right', 'cloud-upload', 'download']) {
    map.set(`/assets/icons/${icon}.svg`, [path.join(toolingRoot, 'assets', 'icons', `${icon}.svg`), 'image/svg+xml']);
  }
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
    map.set(`/preview/assets/mana/${color}.svg`, [path.join(toolingRoot, 'assets', 'mana', `${color}.svg`), 'image/svg+xml']);
  }
  return map;
}

export function createPrimerEditorServer({
  toolingRoot = DEFAULT_TOOLING_ROOT,
  siteRoot = path.resolve(toolingRoot, '..'),
  backupRoot,
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  fetchImpl = fetch,
  publisher = createPrimerPublisher(),
} = {}) {
  if (host !== DEFAULT_HOST) throw new Error('The primer editor may only bind to 127.0.0.1.');
  let server;
  let saveQueue = Promise.resolve();
  const authority = () => `${host}:${server?.address()?.port ?? port}`;
  const origin = () => `http://${authority()}`;
  const staticFiles = safeStaticMap(toolingRoot, siteRoot);
  server = http.createServer(async (request, response) => {
    try {
      if (request.headers.host !== authority()) throw new HttpError(421, 'Host header rejected.');
      const requestUrl = new URL(request.url, origin());
      if (request.method === 'GET' && ['/api/draft-stats', '/api/draft-export'].includes(requestUrl.pathname)) {
        const exporting = requestUrl.pathname.endsWith('export');
        const upstream = await fetch('http://127.0.0.1:8771/' + (exporting ? 'export.csv' : 'stats'), { signal: AbortSignal.timeout(10000) });
        if (!upstream.ok) throw new HttpError(503, 'Draft reports unavailable.');
        const body = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(200, { 'Content-Type': exporting ? 'text/csv; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(exporting ? { 'Content-Disposition': 'attachment; filename="cube-pick-counts.csv"' } : {}) });
        return response.end(body);
      }
      if (request.method === 'GET' && requestUrl.pathname === '/api/publish') {
        return json(response, 200, await publisher.status());
      }
      if (request.method === 'POST' && requestUrl.pathname === '/api/publish') {
        if (request.headers.origin !== origin()) throw new HttpError(403, 'Origin header rejected.');
        const body = await requestBody(request);
        const operation = async () => {
          const current = await loadPrimerContent(path.join(toolingRoot, 'data', 'primer-content.json'));
          if (body.revision !== current.revision) throw new HttpError(409, 'Reload the saved draft before publishing.');
          return publisher.start();
        };
        const queued = saveQueue.then(operation, operation);
        saveQueue = queued.catch(() => {});
        return json(response, 202, await queued);
      }
      if (request.method === 'GET' && requestUrl.pathname === '/api/content') {
        const loaded = await loadPrimerContent(path.join(toolingRoot, 'data', 'primer-content.json'));
        return json(response, 200, { content: loaded.content, revision: loaded.revision });
      }
      if (request.method === 'GET' && requestUrl.pathname === '/api/scryfall') {
        return json(response, 200, { printings: await searchScryfallPrintings(requestUrl.searchParams.get('name'), fetchImpl) });
      }
      if (request.method === 'PUT' && requestUrl.pathname === '/api/content') {
        if (request.headers.host !== authority()) throw new HttpError(421, 'Host header rejected.');
        if (request.headers.origin !== origin()) throw new HttpError(403, 'Origin header rejected.');
        const body = await requestBody(request);
        const operation = async () => {
          const publication = await publisher.status();
          if (['queued', 'running'].includes(publication.state)) throw new HttpError(409, 'Publication is running. Wait before saving another draft.');
          return savePrimerContent({ toolingRoot, siteRoot, backupRoot, expectedRevision: body.revision, proposedContent: body.content });
        };
        const queued = saveQueue.then(operation, operation);
        saveQueue = queued.catch(() => {});
        const saved = await queued;
        return json(response, 200, { content: saved.content, revision: saved.revision, state: 'saved-and-rendered' });
      }
      if (request.method === 'GET' && staticFiles.has(requestUrl.pathname)) {
        const [file, contentType] = staticFiles.get(requestUrl.pathname);
        const body = await fs.readFile(file);
        const preview = requestUrl.pathname.startsWith('/preview/');
        response.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': body.length,
          'Cache-Control': 'no-store',
          'Content-Security-Policy': preview
            ? "default-src 'self'; img-src 'self' https://cards.scryfall.io https://assets.cubecobra.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.scryfall.com https://cubecobra.com; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"
            : "default-src 'self'; img-src 'self' https://cards.scryfall.io; style-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': preview ? 'SAMEORIGIN' : 'DENY',
        });
        return response.end(body);
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) {
      json(response, error.status ?? 500, { error: error.status ? error.message : 'Editor server error.' });
    }
  });
  return { server, host, port, get origin() { return origin(); } };
}

export async function startPrimerEditorServer(options = {}) {
  const instance = createPrimerEditorServer(options);
  await new Promise((resolve, reject) => {
    instance.server.once('error', reject);
    instance.server.listen(instance.port, instance.host, resolve);
  });
  return instance;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const instance = await startPrimerEditorServer();
  console.log(`Primer editor: ${instance.origin}/editor.html`);
  console.log('Loopback only. Use an SSH tunnel for remote access.');
}
