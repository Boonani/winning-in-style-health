import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const url=new URL('../deploy-site/primer.html',import.meta.url).href;
const out='/home/boon/state/primer-motion-20260907',results=[];
for(const [name,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{
  for(const width of [320,375,1280]){
   const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<500});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);
   const mana=page.locator('[data-mana-lesson]');
   await mana.scrollIntoViewIfNeeded();
   const values=async selector=>mana.locator(selector+' td').allTextContents();
   await page.selectOption('#mana-example','1');
   assert.deepEqual(await values('[data-land-row]'),['0','1','0','0','1']);
   await page.selectOption('#mana-example','2');
   assert.deepEqual(await values('[data-land-row]'),['0','0','0','0','1']);
   await mana.locator('[data-pool-target]').check();
   assert.deepEqual(await values('[data-land-row]'),['0','1','0','0','1']);
   await page.selectOption('#mana-example','3');
   assert.deepEqual(await values('[data-land-row]'),['0','0','0','0','0']);
   assert.deepEqual(await values('[data-spell-row]'),['0','0','0','0','1']);
   assert.equal(await mana.locator('.target-toggle').isVisible(),false);
   await page.selectOption('#mana-example','1');
   await mana.screenshot({path:out+'/'+name+'-mana-'+width+'.png'});
   await mana.locator('summary').click();
   await mana.locator('img[data-example-image]').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{const i=document.querySelector('[data-example-image]');return i.complete&&i.naturalWidth>100;});
   const ratio=await mana.locator('[data-example-image]').evaluate(i=>i.naturalWidth/i.naturalHeight);
   assert.ok(ratio>.65&&ratio<.8,'Full portrait card asset');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   const deck=page.locator('[data-deck-lesson]');
   await deck.scrollIntoViewIfNeeded();
   for(let i=0;i<3;i++)await deck.getByRole('button',{name:'One more land',exact:true}).click();
   assert.equal(await deck.locator('.land-count').textContent(),'20');
   assert.equal(await deck.locator('.nonland-count').textContent(),'20');
   assert.equal(await deck.getByRole('button',{name:'One more land',exact:true}).isDisabled(),true);
   for(let i=0;i<6;i++)await deck.getByRole('button',{name:'One fewer land',exact:true}).click();
   assert.equal(await deck.locator('.land-count').textContent(),'14');
   assert.equal(await deck.locator('.nonland-count').textContent(),'26');
   await deck.getByRole('button',{name:'Reset to 17 lands'}).focus();
   await page.keyboard.press('Enter');
   assert.equal(await deck.locator('.land-count').textContent(),'17');
   await page.waitForTimeout(800);
   await deck.screenshot({path:out+'/'+name+'-composition-'+width+'.png'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(errors,[]);
   results.push({name,width,manaCases:true,cardAsset:true,deckBounds:true,keyboard:true,errors});
   await page.close();
  }
  const reduced=await browser.newPage({reducedMotion:'reduce'});
  await reduced.goto(url);
  await reduced.getByRole('button',{name:'One more land',exact:true}).click();
  assert.equal(await reduced.locator('.composition-card').evaluate(e=>getComputedStyle(e).animationName),'none');
  await reduced.close();
  const plain=await browser.newPage({javaScriptEnabled:false});
  await plain.goto(url);
  assert.equal(await plain.locator('#mana-example').isDisabled(),true);
  assert.equal(await plain.locator('.deck-adjustment').isVisible(),false);
  assert.match(await plain.locator('[data-mana-lesson] noscript').textContent(),/Windswept Heath/);
  assert.equal(await plain.locator('.land-count').textContent(),'17');
  await plain.close();
 }
 finally{await browser.close();}
}
await fs.writeFile(out+'/visual-lessons-qa.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
