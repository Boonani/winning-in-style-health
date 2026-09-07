import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const url=new URL('../deploy-site/motion-studies.html',import.meta.url).href;
const out='/home/boon/state/primer-motion-20260907';
const results=[];
for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch();
 try{
  for(const width of [375,1280]){
   const page=await browser.newPage({viewport:{width,height:812},hasTouch:width===375});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);
   assert.equal(await page.locator('#principle option').count(),12);
   const transforms=[];
   for(let mode=0;mode<12;mode++){
    await page.selectOption('#principle',String(mode));
    await page.locator('#progress').fill('550');
    assert.equal(await page.locator('.stage').getAttribute('data-progress'),'0.550');
    transforms.push(await page.locator('#pack').getAttribute('transform'));
    assert.ok((await page.locator('#description').textContent()).length>20);
   }
   assert.ok(new Set(transforms).size>1);
   await page.selectOption('#principle','6');
   await page.getByRole('button',{name:'Play study',exact:true}).click();
   await page.waitForFunction(()=>Number(document.querySelector('.stage').dataset.progress)>.1);
   await page.getByRole('button',{name:'Pause study',exact:true}).click();
   const time=await page.locator('.stage').getAttribute('data-progress');
   await page.waitForTimeout(100);
   assert.equal(await page.locator('.stage').getAttribute('data-progress'),time);
   await page.locator('#progress').fill('550');
   await page.screenshot({path:out+'/'+name+'-studies-'+width+'.png'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   results.push({name,width,twelveModes:true,playPause:true,scrub:true,errors});
   await page.close();
  }
  const reduced=await browser.newPage({reducedMotion:'reduce'});
  await reduced.goto(url);
  await reduced.getByRole('button',{name:'Play study',exact:true}).click();
  assert.equal(await reduced.locator('.stage').getAttribute('data-progress'),'0.250');
  await reduced.waitForTimeout(100);
  assert.equal(await reduced.locator('.stage').getAttribute('data-progress'),'0.250');
  await reduced.close();
  const plain=await browser.newPage({javaScriptEnabled:false});
  await plain.goto(url);await plain.locator('summary').click();
  assert.equal(await plain.locator('h2').count(),12);
  assert.equal(await plain.locator('.controls').isVisible(),false);
  await plain.close();
 }finally{await browser.close();}
}
await fs.writeFile(out+'/studies-qa.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
