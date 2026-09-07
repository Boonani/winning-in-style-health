import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { startPrimerEditorServer } from './primer-editor-server.mjs';

const tooling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.EDITOR_ARTIFACTS || '/home/boon/state/cube-site-20260905/editor-browser';
await fs.mkdir(out, { recursive: true });
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cube-editor-browser-'));
const fixture = path.join(root, 'tooling');
await fs.mkdir(path.join(fixture, 'data'), { recursive: true });
await fs.symlink(path.join(tooling, 'assets'), path.join(fixture, 'assets'));
await fs.symlink(path.join(tooling, 'outputs'), path.join(fixture, 'outputs'));
await fs.copyFile(path.join(tooling, 'editor.html'), path.join(fixture, 'editor.html'));
const original = await fs.readFile(path.join(tooling, 'data/primer-content.json'), 'utf8');
let publication = { state: 'idle' };
const instance = await startPrimerEditorServer({
  port: 0, toolingRoot: fixture, siteRoot: root, backupRoot: path.join(root, 'backups'),
  publisher: { status: async () => publication, start: async () => (publication = { state: 'queued', phase: 'Queued' }) },
  fetchImpl: async () => ({ ok: true, json: async () => ({ data: [{
    id: 'b4e9c870-23c0-413a-ae39-265f09da16d1', name: 'Swords to Plowshares', set: 'msc',
    collector_number: '143', released_at: '2026-06-26', lang: 'en', layout: 'normal',
    oracle_text: 'Exile target creature. Its controller gains life equal to its power.',
    image_uris: { normal: 'https://cards.scryfall.io/normal/front/b/4/b4e9c870-23c0-413a-ae39-265f09da16d1.jpg' },
  }] }) }),
});
const report = [];
try {
  for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch({ headless: true });
    try {
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
        publication = { state: 'idle' };
        await fs.writeFile(path.join(fixture, 'data/primer-content.json'), original);
        await fs.copyFile(path.join(tooling, '../primer.html'), path.join(root, 'primer.html'));
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${instance.origin}/editor.html`, { waitUntil: 'domcontentloaded' });
        const saved = () => page.waitForFunction(() => document.querySelector('#status')?.dataset.state === 'saved');
        await saved();
        assert.equal(await page.locator('iframe').contentFrame().locator('h1').isVisible(), true);
        assert.ok(await page.locator('.edit-card').count() > 20);
        const manaGroup = page.locator('.edit-group').filter({ has: page.getByRole('heading', { name: 'Fix first. Add colors later.', exact: true }) });
        const finishGroup = page.locator('.edit-group').filter({ has: page.getByRole('heading', { name: 'Have a way through.', exact: true }) });
        assert.equal(await finishGroup.locator('.add-card').count(), 1);
        await manaGroup.locator('.add-card').click();
        await page.locator('#card-name').fill('Swords to Plowshares');
        await page.locator('#printing-search button[type="submit"]').click();
        await page.getByRole('button', { name: 'Use this printing' }).click();
        // Section controls close over their source object; consecutive saves must rebind it.
        const heading = page.getByLabel('Heading', { exact: true }).first();
        for (const value of ['First saved heading', 'Second saved heading']) {
          await heading.fill(value);
          await page.locator('#save').click();
          await saved();
          assert.equal(await heading.inputValue(), value);
          const disk = JSON.parse(await fs.readFile(path.join(fixture, 'data/primer-content.json'), 'utf8'));
          assert.equal(disk.sections[0].heading, value);
          assert.equal(disk.sections.find(s => s.id === 'mana').cards.length, JSON.parse(original).sections.find(s => s.id === 'mana').cards.length + 1);
          assert.match(await fs.readFile(path.join(root, 'primer.html'), 'utf8'), new RegExp(value));
        }
        await page.reload();
        await saved();
        assert.equal(await heading.inputValue(), 'Second saved heading');
        await page.locator('button[title^="Move"][title$="down"]:enabled').first().click();
        await page.locator('button[title^="Change"]').first().click();
        await page.locator('#printing-search button[type="submit"]').click();
        await page.getByRole('button', { name: 'Use this printing' }).click();
        await page.locator('#save').click();
        await saved();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.locator('#publish').click();
        await page.waitForFunction(() => document.querySelector('#publication-status')?.textContent === 'Queued');
        assert.equal(await page.locator('#save').isDisabled(), true);
        assert.equal(await page.locator('#editor').evaluate(el => el.inert), true);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(out, `${engine}-${viewport.width}-editor.png`), fullPage: false });
        report.push({ engine, viewport, consecutiveSaves: 2, reloaded: true, printingSelected: true, publishFrozen: true, passed: true });
        console.log(JSON.stringify(report.at(-1)));
        await page.close({ runBeforeUnload: false });
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolve => instance.server.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}
await fs.writeFile(path.join(out, 'editor-browser-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log('EDITOR_UI_OK');
