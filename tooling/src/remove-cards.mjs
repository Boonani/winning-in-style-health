import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'https://cubecobra.com';
const userAgent = 'WinningInStyleCubeHealth/1.0 (+https://cubecobra.com/cube/about/style)';
const apply = process.argv.includes('--apply');
const requestedCuts = [
  'All That Glitters',
  'Eidolon of Blossoms',
  'Sanctum Weaver',
  'Setessan Champion',
];

class Session {
  cookies = new Map();

  absorb(response) {
    for (const value of response.headers.getSetCookie?.() ?? []) {
      const first = value.split(';', 1)[0];
      const separator = first.indexOf('=');
      if (separator > 0) this.cookies.set(first.slice(0, separator), first.slice(separator + 1));
    }
  }

  async request(url, options = {}, redirects = 8) {
    const headers = new Headers(options.headers ?? {});
    headers.set('User-Agent', userAgent);
    if (this.cookies.size) headers.set('Cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    const response = await fetch(url, { ...options, headers, redirect: 'manual' });
    this.absorb(response);
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get('location')) {
      if (redirects <= 0) throw new Error(`Too many redirects after ${url}`);
      const next = new URL(response.headers.get('location'), url).href;
      const preserveMethod = response.status === 307 || response.status === 308;
      return this.request(next, preserveMethod ? options : { method: 'GET', headers: { Accept: 'text/html' } }, redirects - 1);
    }
    return response;
  }
}

async function readJson(response, label) {
  const body = await response.text();
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${body.slice(0, 500)}`);
  return JSON.parse(body);
}

async function authenticate() {
  const username = process.env.CUBE_COBRA_LOGIN;
  const password = process.env.CUBE_COBRA_PASSWORD;
  if (!username || !password) throw new Error('CUBE_COBRA_LOGIN and CUBE_COBRA_PASSWORD must be present in the process environment.');
  const session = new Session();
  const landing = await session.request(`${baseUrl}/user/login`);
  if (!landing.ok) throw new Error(`Login page failed: ${landing.status} ${landing.statusText}`);
  await landing.arrayBuffer();
  const login = await session.request(`${baseUrl}/user/login`, {
    method: 'POST',
    headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${baseUrl}/user/login` },
    body: new URLSearchParams({ username, password, nickname: 'Your Nickname' }),
  });
  if (!login.ok) throw new Error(`Login failed: ${login.status} ${login.statusText}`);
  await login.arrayBuffer();
  const mine = await readJson(await session.request(`${baseUrl}/cube/api/mycubes/`, { headers: { Accept: 'application/json' } }), 'Authentication check');
  if (mine.success !== 'true') throw new Error(`Authentication check returned success=${mine.success}`);
  return { session, cubes: mine.cubes };
}

async function main() {
  const analysis = JSON.parse(await fs.readFile(path.join(root, 'outputs', 'analysis.json'), 'utf8'));
  const requested = requestedCuts.map((name) => {
    const card = analysis.cards.find((item) => item.board === 'mainboard' && item.name === name);
    if (!card) throw new Error(`Requested cut is missing from the analyzed mainboard: ${name}`);
    if (!card.weakness?.userRequestedRemoval || card.weakness.reviewTier !== 'Likely cut') {
      throw new Error(`Requested cut has not passed the owner-removal verification gate: ${name}`);
    }
    return card;
  });

  const { session, cubes } = await authenticate();
  if (!cubes.some((cube) => cube.id === analysis.cube.id && cube.shortId === analysis.cube.shortId)) {
    throw new Error(`Authenticated account does not own ${analysis.cube.shortId} (${analysis.cube.id}).`);
  }
  const live = await readJson(
    await session.request(`${baseUrl}/cube/api/cubeJSON/${analysis.cube.shortId}?fresh=${Date.now()}`, { headers: { Accept: 'application/json' } }),
    'Live cube read',
  );
  if (live.id !== analysis.cube.id) throw new Error(`Cube identity mismatch: expected ${analysis.cube.id}, received ${live.id}`);
  if (live.version !== analysis.cube.version) throw new Error(`Cube version changed: analysis=${analysis.cube.version}, live=${live.version}. Run npm run refresh first.`);

  const removes = requested.map((candidate) => {
    const matches = live.cards.mainboard.filter((card) => card.cardID === candidate.cardID && card.details?.name === candidate.name);
    if (matches.length !== 1) throw new Error(`Expected exactly one live ${candidate.name}, found ${matches.length}.`);
    const current = matches[0];
    if (Number(current.index) !== candidate.index) throw new Error(`Index changed for ${candidate.name}: analysis=${candidate.index}, live=${current.index}.`);
    const { details: _details, ...oldCard } = current;
    return { index: Number(current.index), oldCard };
  });

  console.log(JSON.stringify({
    authenticated: true,
    accountOwnsCube: true,
    cube: live.shortId,
    version: live.version,
    mainboardBefore: live.cards.mainboard.length,
    removals: requestedCuts,
    mode: apply ? 'apply' : 'dry-run',
  }, null, 2));
  if (!apply) return;

  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const backupDir = path.join(root, 'backups', stamp);
  await fs.mkdir(backupDir, { recursive: true });
  const csvResponse = await session.request(`${baseUrl}/cube/download/csv/${live.shortId}?fresh=${Date.now()}`, { headers: { Accept: 'text/plain' } });
  const csvText = await csvResponse.text();
  if (!csvResponse.ok) throw new Error(`Backup CSV failed: ${csvResponse.status} ${csvText.slice(0, 300)}`);
  await Promise.all([
    fs.writeFile(path.join(backupDir, 'cube-before.json'), `${JSON.stringify(live, null, 2)}\n`),
    fs.writeFile(path.join(backupDir, 'cube-before.csv'), csvText),
    fs.writeFile(path.join(backupDir, 'removals.json'), `${JSON.stringify({ cube: analysis.cube, cards: requested }, null, 2)}\n`),
  ]);

  const commit = await readJson(await session.request(`${baseUrl}/cube/api/commit`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'CSRF-Token': '', Referer: `${baseUrl}/cube/list/${live.shortId}` },
    body: JSON.stringify({
      id: live.id,
      changes: { mainboard: { removes } },
      title: 'Retire GW Enchantress package',
      blog: '',
      useBlog: false,
      expectedVersion: live.version,
    }),
  }), 'Remove-card commit');
  await fs.writeFile(path.join(backupDir, 'commit-result.json'), `${JSON.stringify(commit, null, 2)}\n`);
  if (commit.success !== 'true' || !commit.updateApplied) throw new Error(`Commit was not applied: ${JSON.stringify(commit)}`);

  let verified;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    verified = await readJson(
      await session.request(`${baseUrl}/cube/api/cubeJSON/${live.shortId}?verify=${Date.now()}-${attempt}`, { headers: { Accept: 'application/json' } }),
      `Verification read ${attempt}`,
    );
    const stillPresent = verified.cards.mainboard.filter((card) => requestedCuts.includes(card.details?.name));
    if (verified.version === commit.version && verified.cards.mainboard.length === live.cards.mainboard.length - requested.length && stillPresent.length === 0) break;
  }
  await fs.writeFile(path.join(backupDir, 'cube-after.json'), `${JSON.stringify(verified, null, 2)}\n`);
  const stillPresent = verified.cards.mainboard.filter((card) => requestedCuts.includes(card.details?.name));
  if (verified.version !== commit.version || verified.cards.mainboard.length !== live.cards.mainboard.length - requested.length || stillPresent.length) {
    throw new Error(`Post-commit verification failed: liveVersion=${verified.version}, commitVersion=${commit.version}, mainboard=${verified.cards.mainboard.length}, remainingRequestedCuts=${stillPresent.length}. Backup: ${backupDir}`);
  }
  console.log(JSON.stringify({
    applied: true,
    previousVersion: live.version,
    newVersion: verified.version,
    removed: requestedCuts,
    mainboardAfter: verified.cards.mainboard.length,
    backupDir,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
