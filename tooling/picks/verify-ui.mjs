import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const origin = process.env.PICKS_TEST_URL || 'http://127.0.0.1:8772';
const out = process.env.PICKS_ARTIFACTS || '/home/boon/state/cube-picks-20260905/browser';
await fs.mkdir(out, { recursive: true });
const report = [];
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
 const browser = await type.launch({ headless: true });
 try {
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]) {
   const page = await browser.newPage({ viewport });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   for (const kind of ['first','last']) {
    await page.goto(origin + '/?pick=' + kind, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#card').disabled);
    assert.match(await page.locator('h1').innerText(), kind === 'first' ? /first pick/ : /last card/);
    await page.locator('#card').fill('lightning bolt');
    await page.locator('#card').press('ArrowDown'); await page.locator('#card').press('Enter');
    assert.equal(await page.locator('#selection').innerText(), 'Lightning Bolt');
    await page.locator('[name="pack"][value="' + (kind === 'first' ? 1 : 3) + '"]').check();
    await page.locator('#experience').selectOption(kind === 'first' ? '0' : '5');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), false);
    await page.screenshot({ path: out + '/' + engine + '-' + viewport.width + '-' + kind + '.png' });
    const submitted = page.waitForRequest(request => request.url().endsWith('/api/picks') && request.method() === 'POST');
    await page.locator('#submit').click();
    const payload = (await submitted).postDataJSON();
    assert.equal(payload.kind,kind); assert.equal(payload.experience, kind === 'first' ? 0 : 5);
    await page.waitForFunction(() => !document.querySelector('#success').hidden);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('cube-pending-pick')),null);
    assert.deepEqual(await page.context().cookies(), []);
   }
   await page.goto('http://127.0.0.1:8768/stats.html',{waitUntil:'domcontentloaded'});
   await page.route('**/api/draft-stats', async route => {
    const data = await (await fetch('http://127.0.0.1:8773/stats')).json();
    await route.fulfill({json:data});
   });
   await page.locator('#refresh').click();
   await page.waitForFunction(() => document.querySelector('#rows tr'));
   await page.locator('#experience').selectOption('0');
   assert.match(await page.locator('#totals').innerText(), /0 last cards/);
   await page.locator('#pack').selectOption('3');
   assert.equal(await page.locator('#rows tr').count(),0);
   await page.locator('#pack').selectOption('');
   await page.locator('#experience').selectOption('5');
   assert.match(await page.locator('#totals').innerText(), /^0 first picks/);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), false);
   await page.screenshot({path:out + '/' + engine + '-' + viewport.width + '-stats.png'});
   assert.deepEqual(errors,[]);
   report.push({engine,viewport,firstAndLast:true,experienceZero:true,statsFilters:true,passed:true});
   await page.close();
  }
  const retry = await browser.newPage({viewport:{width:390,height:844}});
  let loseResponse = true, ids = [];
  await retry.route('**/api/picks', async route => {
   ids.push(route.request().postDataJSON().submissionId);
   if (loseResponse) { loseResponse=false; await route.fetch(); await route.abort('failed'); }
   else await route.continue();
  });
  await retry.goto(origin + '/?pick=last');
  await retry.waitForFunction(() => !document.querySelector('#card').disabled);
  await retry.locator('#card').fill('lightning bolt'); await retry.locator('#matches li').first().click();
  await retry.locator('[name="pack"][value="2"]').check(); await retry.locator('#experience').selectOption('2');
  await retry.locator('#submit').click();
  await retry.waitForFunction(() => document.querySelector('#status').textContent.includes('Retry'));
  await retry.reload();
  await retry.waitForFunction(() => document.querySelector('#status').textContent.includes('confirmation'));
  await retry.locator('#submit').click(); await retry.waitForFunction(() => !document.querySelector('#success').hidden);
  assert.equal(ids.length,2); assert.equal(ids[0],ids[1]);
  await retry.close();
 } finally { await browser.close(); }
}
await fs.writeFile(out + '/results.json',JSON.stringify(report,null,2));
console.log('PICKS_UI_OK ' + report.length + ' profiles; lost-response retries kept one receipt.');
