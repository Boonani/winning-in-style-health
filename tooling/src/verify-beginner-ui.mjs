import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { PRACTICE_URL } from './draft-primer.mjs';
const out = process.env.BEGINNER_ARTIFACTS || '/home/boon/state/primer-advice-20260907';
const target = process.env.PRIMER_URL || pathToFileURL(path.resolve(import.meta.dirname,'../../primer.html')).href;
const report = [];
for (const [name, engine] of [['chromium',chromium],['webkit',webkit]]) {
 const browser = await engine.launch();
 try {
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]) {
   const page = await browser.newPage({viewport, reducedMotion:'reduce'});
   const errors=[]; page.on('pageerror',e=>errors.push(e.message));
   await page.goto(target);
   assert.equal(await page.locator('.deck i').count(),40);
   assert.equal(await page.locator('#explore-strategies').getAttribute('open'),null);
   assert.equal(await page.locator('.practice').getAttribute('href'),PRACTICE_URL);
   assert.equal(await page.locator('.practice').innerText(),'Practice drafting against bots and have fun!');
   await page.screenshot({path:path.join(out,name+'-'+viewport.width+'-primer.png')});
   const check = async () => assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1),false);
   await check();
   await page.locator('#explore-strategies > summary').focus();
   await page.keyboard.press('Enter');
   assert.equal(await page.locator('#explore-strategies').evaluate(e=>e.open),true);
   // All optional content must fit when expanded, with no required JavaScript.
   await page.evaluate(()=>document.querySelectorAll('details').forEach(e=>e.open=true));
   for (const img of await page.locator('.primer-card img').all()) {
    await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(im=>im.complete && im.naturalWidth>0, await img.elementHandle());
    assert.ok(await img.evaluate(im=>im.naturalWidth>0));
    assert.equal(await img.evaluate(im=>getComputedStyle(im).objectFit),'contain');
   }
   await check();
   await page.locator('.practice').scrollIntoViewIfNeeded();
   const box=await page.locator('.practice').boundingBox();
   assert.ok(box.x>=0 && box.x+box.width<=viewport.width+1 && box.height>=44);
   await page.screenshot({path:path.join(out,name+'-'+viewport.width+'-practice.png')});
   assert.deepEqual(errors,[]);
   await page.close();
   const nojs=await browser.newPage({viewport,javaScriptEnabled:false});
   await nojs.goto(target);
   assert.equal(await nojs.locator('h1').isVisible(),true);
   await nojs.locator('#explore-strategies > summary').click();
   assert.equal(await nojs.locator('.plans summary').first().isVisible(),true);
   await nojs.close();
   report.push({engine:name,viewport,passed:true});
  }
 } finally { await browser.close(); }
}
await fs.writeFile(path.join(out,'beginner-browser-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
