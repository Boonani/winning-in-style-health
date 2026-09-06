import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
const state = process.env.CUBE_PUBLISH_STATE || '/home/boon/state/cube-site-editor';
await fs.mkdir(state, { recursive: true, mode: 0o700 });
const statusPath = path.join(state, 'publish.json');
const log = await fs.open(path.join(state, 'publish.log'), 'a', 0o600);
const start = new Date().toISOString();
const status = async value => {
  const temp = statusPath + '.tmp';
  await fs.writeFile(temp, JSON.stringify({ startedAt: start, updatedAt: new Date().toISOString(), ...value }, null, 2));
  await fs.rename(temp, statusPath);
};
async function run(cmd, args, cwd = root) {
  await log.appendFile('\n$ ' + cmd + ' ' + args.join(' ') + '\n');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, DASHBOARD_DEPLOY_DIR: '..', GIT_TERMINAL_PROMPT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let result = '';
    child.stdout.on('data', bytes => { result += bytes; void log.appendFile(bytes); });
    child.stderr.on('data', bytes => { void log.appendFile(bytes); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(result.trim()) : reject(new Error(cmd + ' failed (' + code + '). See publish.log.')));
  });
}
const allowed = ['tooling/data/primer-content.json', 'draft-primer.html', 'tooling/reports/CUBE_COBRA_PRIMER.md'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  await status({ state: 'running', phase: 'Checking saved changes' });
  if (await run('git', ['branch', '--show-current']) !== 'main') throw new Error('Publish requires the main branch.');
  const checkNames = async () => {
    const names = (await run('git', ['diff', '--name-only', 'HEAD'])).split('\n').filter(Boolean);
    const untracked = (await run('git', ['ls-files', '--others', '--exclude-standard'])).split('\n').filter(Boolean);
    const unexpected = [...names, ...untracked].filter(name => !allowed.includes(name));
    if (unexpected.length) throw new Error('Unreviewed changes outside primer content: ' + unexpected.join(', '));
    return names;
  };
  await checkNames();
  await run('git', ['fetch', 'origin', 'main']);
  await run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
  const aheadNames = (await run('git', ['diff', '--name-only', 'origin/main', 'HEAD'])).split('\n').filter(Boolean);
  if (aheadNames.some(name => !allowed.includes(name))) {
    throw new Error('Unpublished code changes require a separate reviewed release.');
  }
  await status({ state: 'running', phase: 'Building and testing' });
  await run('npm', ['run', 'build:dashboard'], path.join(root, 'tooling'));
  await run('npm', ['test'], path.join(root, 'tooling'));
  await run('npm', ['run', 'verify:deploy'], path.join(root, 'tooling'));
  const names = await checkNames();
  if (names.length) {
    await run('git', ['add', '--', ...allowed]);
    await run('git', ['commit', '-m', '✏️ Give the Cube a fresh line']);
  }
  await status({ state: 'running', phase: 'Pushing saved primer' });
  await run('git', ['push', 'origin', 'main']);
  const commit = await run('git', ['rev-parse', 'HEAD']);
  await status({ state: 'running', phase: 'Waiting for the public site', commit });
  const expected = hash(await fs.readFile(path.join(root, 'draft-primer.html')));
  let live = false;
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const response = await fetch('https://cube.coolasheck.com/draft-primer.html?publish=' + commit + '-' + attempt, { signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' } });
      if (response.ok && hash(Buffer.from(await response.arrayBuffer())) === expected) { live = true; break; }
    } catch { /* A deploy can briefly fail while Pages switches versions. */ }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  if (!live) throw new Error('Changes were pushed, but public verification timed out. Check GitHub Pages before retrying.');
  await status({ state: 'complete', phase: 'Live', commit, url: 'https://cube.coolasheck.com/draft-primer.html', sha256: expected, sourceRevision: hash(await fs.readFile(path.join(root, 'tooling/data/primer-content.json'))) });
} catch (error) {
  await status({ state: 'failed', phase: error.message });
  await log.appendFile('\nERROR: ' + error.message + '\n');
  process.exitCode = 1;
} finally {
  await log.close();
}
