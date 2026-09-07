import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const results=[];
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{
  const page=await browser.newPage({viewport:{width:375,height:900}});
  await page.clock.install();
  await page.goto(new URL('../deploy-site/primer.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
  const root=page.locator('[data-draft-animation]');
  await root.scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Play animation',exact:true}).click();
  await page.clock.runFor(7200);
  assert.equal(await root.getAttribute('data-time'),'6.500');
  assert.equal(await root.locator('[data-status="flight"]').count(),0);
  await page.clock.runFor(2200);
  assert.equal(await root.getAttribute('data-cycles'),'1');
  assert.ok(Number(await root.getAttribute('data-time'))<1);
  results.push({engine,settledHold:true,restarted:true});
 }finally{await browser.close();}
}
await fs.writeFile('/home/boon/state/primer-motion-20260907/loops/settled-end.json',JSON.stringify(results,null,2));
console.log(results);
