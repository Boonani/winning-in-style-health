import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestProposal } from './proposal-digest.mjs';
import { execFileSync } from 'node:child_process';
import { validateProposalCoverage, verifyTagOnlyCommit } from './tag-sync-guards.mjs';
import { verifyRawTagSemantics } from './raw-tag-verification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proposalPath = path.join(root, 'outputs', 'proposed-live-tags.json');
const semanticVerificationPath = path.join(root, 'outputs', 'semantic-verification.json');
const baseUrl = 'https://cubecobra.com';
const userAgent = 'WinningInStyleCubeHealth/1.0 (+https://cubecobra.com/cube/about/style)';
const apply = process.argv.includes('--apply');

class Session {
  cookies = new Map();

  absorb(response) {
    const values = response.headers.getSetCookie?.() ?? [];
    for (const value of values) {
      const first = value.split(';', 1)[0];
      const separator = first.indexOf('=');
      if (separator > 0) this.cookies.set(first.slice(0, separator), first.slice(separator + 1));
    }
  }

  async request(url, options = {}, redirects = 8) {
    if (new URL(url).origin !== baseUrl) throw new Error('Refusing to send session credentials outside Cube Cobra.');
    const headers = new Headers(options.headers ?? {});
    headers.set('User-Agent', userAgent);
    if (this.cookies.size) headers.set('Cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    const response = await fetch(url, { ...options, headers, redirect: 'manual', signal: AbortSignal.timeout(45000) });
    this.absorb(response);
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get('location')) {
      if (redirects <= 0) throw new Error(`Too many redirects after ${url}`);
      const next = new URL(response.headers.get('location'), url).href;
      const preserveMethod = response.status === 307 || response.status === 308;
      const nextOptions = preserveMethod ? options : { method: 'GET', headers: { Accept: 'text/html' } };
      return this.request(next, nextOptions, redirects - 1);
    }
    return response;
  }
}

const sameTags = (left = [], right = []) =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

async function authenticate() {
  const username = process.env.CUBE_COBRA_LOGIN;
  const password = process.env.CUBE_COBRA_PASSWORD;
  if (!username || !password) {
    throw new Error('CUBE_COBRA_LOGIN and CUBE_COBRA_PASSWORD must be present in the process environment.');
  }
  const session = new Session();
  const landing = await session.request(`${baseUrl}/user/login`);
  if (!landing.ok) throw new Error(`Login page failed: ${landing.status} ${landing.statusText}`);
  await landing.arrayBuffer();

  const body = new URLSearchParams({ username, password, nickname: 'Your Nickname' });
  const result = await session.request(`${baseUrl}/user/login`, {
    method: 'POST',
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${baseUrl}/user/login`,
    },
    body,
  });
  if (!result.ok) throw new Error(`Login failed: ${result.status} ${result.statusText}`);
  await result.arrayBuffer();

  const mineResponse = await session.request(`${baseUrl}/cube/api/mycubes/`, { headers: { Accept: 'application/json' } });
  const mineText = await mineResponse.text();
  if (!mineResponse.ok) throw new Error(`Authentication check failed: ${mineResponse.status} ${mineText.slice(0, 300)}`);
  const mine = JSON.parse(mineText);
  if (mine.success !== 'true') throw new Error(`Authentication check returned success=${mine.success}`);
  return { session, cubes: mine.cubes };
}

async function readJson(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function main() {
  if (process.argv.includes('--auth-check')) {
    const { cubes } = await authenticate();
    const owned = cubes.some((cube) => cube.shortId === 'style' && cube.id === '1fd964c1-9092-46f8-8188-5e933e12e190');
    if (!owned) throw new Error('Authenticated account does not own the expected Winning in Style cube.');
    console.log(JSON.stringify({ authenticated: true, accountOwnsCube: true, cube: 'style', mode: 'auth-check', writes: 0 }));
    return;
  }
  // Run the actual semantic checks now rather than trust an old receipt alone.
  execFileSync(process.execPath, [path.join(root, 'src', 'verify.mjs')], { cwd: root, stdio: 'inherit' });
  const snapshot = JSON.parse(await fs.readFile(path.join(root, 'data', 'raw', 'cube.json'), 'utf8'));
  const proposal = JSON.parse(await fs.readFile(proposalPath, 'utf8'));
  const verification = JSON.parse(await fs.readFile(semanticVerificationPath, 'utf8'));
  if (proposal.semanticGate?.contract !== 'strict-v2' || !proposal.semanticGate?.verificationRequired) {
    throw new Error('Proposal is missing the strict-v2 semantic gate. Run npm run analyze and npm run verify.');
  }
  if (!verification.verified || verification.contract !== proposal.semanticGate.contract) {
    throw new Error('Strict semantic verification has not passed. Run npm run verify before any Cube Cobra write.');
  }
  if (verification.generatedAt !== proposal.generatedAt || verification.cubeVersion !== proposal.cube.version) {
    throw new Error(`Semantic verification is stale: verification=${verification.generatedAt}/v${verification.cubeVersion}, proposal=${proposal.generatedAt}/v${proposal.cube.version}. Run npm run verify.`);
  }
  const digest = digestProposal(proposal.cards);
  if (!verification.proposalDigest || verification.proposalDigest !== digest) {
    throw new Error('Proposed live tags do not match the semantically verified proposal digest. Run npm run analyze and npm run verify.');
  }
  const rawVerification = verifyRawTagSemantics(proposal, snapshot);
  console.log(JSON.stringify(rawVerification));
  const { session, cubes } = await authenticate();
  const owned = cubes.find((cube) => cube.id === proposal.cube.id && cube.shortId === proposal.cube.shortId);
  if (!owned) throw new Error(`Authenticated account does not own ${proposal.cube.shortId} (${proposal.cube.id}).`);

  const live = await readJson(
    await session.request(`${baseUrl}/cube/api/cubeJSON/${proposal.cube.shortId}?fresh=${Date.now()}`, { headers: { Accept: 'application/json' } }),
    'Live cube read',
  );
  if (live.id !== proposal.cube.id) throw new Error(`Cube identity mismatch: expected ${proposal.cube.id}, received ${live.id}`);
  if (live.version !== proposal.cube.version) {
    throw new Error(`Cube version changed: proposal=${proposal.cube.version}, live=${live.version}. Run npm run refresh before applying.`);
  }

  validateProposalCoverage(proposal, live, snapshot);
  const editsByBoard = {};
  let unchanged = 0;
  for (const proposed of proposal.cards) {
    const current = live.cards?.[proposed.board]?.find((card) => Number(card.index) === proposed.index);
    if (!current) throw new Error(`Missing live card at ${proposed.board}[${proposed.index}] (${proposed.name}).`);
    if (current.cardID !== proposed.cardID) {
      throw new Error(`Card mismatch at ${proposed.board}[${proposed.index}]: proposal=${proposed.cardID}, live=${current.cardID}.`);
    }
    if (sameTags(current.tags, proposed.tags)) {
      unchanged += 1;
      continue;
    }
    editsByBoard[proposed.board] ??= [];
    const { details: _details, ...oldCard } = current;
    editsByBoard[proposed.board].push({
      index: proposed.index,
      oldCard,
      newCard: { ...oldCard, tags: proposed.tags },
    });
  }

  const editCount = Object.values(editsByBoard).reduce((sum, edits) => sum + edits.length, 0);
  const assignmentCount = proposal.cards.reduce((sum, card) => sum + card.tags.length, 0);
  console.log(JSON.stringify({
    authenticated: true,
    accountOwnsCube: true,
    cube: proposal.cube.shortId,
    version: live.version,
    cardsChecked: proposal.cards.length,
    cardsToEdit: editCount,
    unchanged,
    proposedTagAssignments: assignmentCount,
    mode: apply ? 'apply' : 'dry-run',
  }, null, 2));

  if (!apply || editCount === 0) return;

  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const backupDir = path.join(root, 'backups', stamp);
  await fs.mkdir(backupDir, { recursive: true });
  const csvResponse = await session.request(`${baseUrl}/cube/download/csv/${proposal.cube.shortId}?fresh=${Date.now()}`, { headers: { Accept: 'text/plain' } });
  const csvText = await csvResponse.text();
  if (!csvResponse.ok) throw new Error(`Backup CSV failed: ${csvResponse.status} ${csvText.slice(0, 300)}`);
  await Promise.all([
    fs.writeFile(path.join(backupDir, 'cube-before.json'), `${JSON.stringify(live, null, 2)}\n`),
    fs.writeFile(path.join(backupDir, 'cube-before.csv'), csvText),
    fs.writeFile(path.join(backupDir, 'proposal.json'), `${JSON.stringify(proposal, null, 2)}\n`),
  ]);

  const changes = Object.fromEntries(Object.entries(editsByBoard).map(([board, edits]) => [board, { edits }]));
  const commitResponse = await session.request(`${baseUrl}/cube/api/commit`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'CSRF-Token': '',
      Referer: `${baseUrl}/cube/list/${proposal.cube.shortId}`,
    },
    body: JSON.stringify({
      id: proposal.cube.id,
      changes,
      title: 'Synergy taxonomy',
      blog: '',
      useBlog: false,
      expectedVersion: live.version,
    }),
  });
  const commitText = await commitResponse.text();
  let commit;
  try {
    commit = JSON.parse(commitText);
  } catch {
    throw new Error(`Commit returned non-JSON (${commitResponse.status}): ${commitText.slice(0, 500)}`);
  }
  await fs.writeFile(path.join(backupDir, 'commit-result.json'), `${JSON.stringify(commit, null, 2)}\n`);
  if (!commitResponse.ok || commit.success !== 'true') {
    throw new Error(`Commit failed (${commitResponse.status}): ${commit.message ?? commitText.slice(0, 500)}`);
  }

  let verified;
  let mismatches = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    verified = await readJson(
      await session.request(`${baseUrl}/cube/api/cubeJSON/${proposal.cube.shortId}?verify=${Date.now()}-${attempt}`, { headers: { Accept: 'application/json' } }),
      `Verification read ${attempt}`,
    );
    mismatches = proposal.cards.filter((proposed) => {
      const current = verified.cards?.[proposed.board]?.find((card) => Number(card.index) === proposed.index);
      return !current || current.cardID !== proposed.cardID || !sameTags(current.tags, proposed.tags);
    });
    if (verified.version === commit.version && mismatches.length === 0) break;
  }
  await fs.writeFile(path.join(backupDir, 'cube-after.json'), `${JSON.stringify(verified, null, 2)}\n`);
  if (verified.version !== commit.version || mismatches.length) {
    throw new Error(`Post-commit verification failed: liveVersion=${verified.version}, commitVersion=${commit.version}, tagMismatches=${mismatches.length}. Backup: ${backupDir}`);
  }

  const preservation = verifyTagOnlyCommit(live, verified, proposal, commit.version);
  await fs.writeFile(path.join(backupDir, 'verification.json'), `${JSON.stringify(preservation, null, 2)}\n`);
  console.log(JSON.stringify({
    applied: true,
    nonTagMismatches: preservation.nonTagMismatches,
    previousVersion: live.version,
    newVersion: verified.version,
    cardsEdited: editCount,
    verifiedCards: proposal.cards.length,
    tagMismatches: 0,
    backupDir,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
