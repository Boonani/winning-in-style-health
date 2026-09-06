import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

export function createPrimerPublisher({
  stateRoot = '/home/boon/state/cube-site-editor',
  service = async args => (await exec('systemctl', ['--user', ...args], { timeout: 15000 })).stdout.trim(),
} = {}) {
  const file = path.join(stateRoot, 'publish.json');
  async function status() {
    let saved = { state: 'idle', phase: 'Not published from this editor yet.' };
    try { saved = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    let active;
    try { active = await service(['show', 'cube-primer-publish.service', '--property=ActiveState', '--value']); }
    catch { return { ...saved, state: 'unavailable', phase: 'Publishing service is unavailable.' }; }
    if (active === 'active' || active === 'activating') return { ...saved, state: 'running' };
    if (saved.state === 'queued' && Date.now() - Date.parse(saved.updatedAt) < 15000) return saved;
    if (['queued', 'running'].includes(saved.state)) return { ...saved, state: 'failed', phase: 'Publishing stopped before completion. The saved draft is intact.' };
    return saved;
  }
  let starting = false;
  async function start() {
    if (starting) throw Object.assign(new Error('Publishing is already starting.'), { status: 409 });
    starting = true;
    try {
      const current = await status();
      if (['queued', 'running'].includes(current.state)) throw Object.assign(new Error('Publishing is already running.'), { status: 409 });
      if (current.state === 'unavailable') throw Object.assign(new Error(current.phase), { status: 503 });
      await fs.mkdir(stateRoot, { recursive: true, mode: 0o700 });
      const queued = { state: 'queued', phase: 'Starting publication', updatedAt: new Date().toISOString() };
      await fs.writeFile(file, JSON.stringify(queued), { mode: 0o600 });
      try { await service(['start', '--no-block', 'cube-primer-publish.service']); }
      catch (error) {
        await fs.writeFile(file, JSON.stringify({ state: 'failed', phase: 'Could not start publishing. Draft remains saved.', updatedAt: new Date().toISOString() }));
        throw error;
      }
      return queued;
    } finally { starting = false; }
  }
  return { status, start };
}
