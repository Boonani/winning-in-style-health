import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const url=new URL('../deploy-site/primer.html',import.meta.url).href;
const out='/home/boon/state/primer-motion-20260907',results=[];
for(const [name,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{
  for(const width of [375,1280]){
   const page=await browser.newPage({viewport:{width,height:900},hasTouch:width===375});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);
   for(const kind of ['removal','finish','plan-lesson']){
    await page.emulateMedia({reducedMotion:'no-preference'});
    const scene=page.locator('[data-concept="'+kind+'"]');
    await scene.scrollIntoViewIfNeeded();
    const before=await scene.locator('[data-actor]').getAttribute('transform');
    await scene.locator('[data-play]').click();
    await page.waitForFunction(k=>Number(document.querySelector('[data-concept="'+k+'"]').dataset.progress)>.45,kind);
    await scene.locator('[data-play]').click();
    assert.notEqual(await scene.locator('[data-actor]').getAttribute('transform'),before);
    const stopped=await scene.getAttribute('data-progress');
    await page.waitForTimeout(100);
    assert.equal(await scene.getAttribute('data-progress'),stopped);
    await scene.screenshot({path:out+'/'+name+'-'+kind+'-'+width+'.png'});
    await scene.locator('[data-restart]').focus();await page.keyboard.press('Enter');
    assert.equal(await scene.getAttribute('data-progress'),'0.000');
    await page.emulateMedia({reducedMotion:'reduce'});
    await scene.locator('[data-play]').click();
    assert.equal(await scene.getAttribute('data-progress'),'1.000');
    assert.equal(await scene.locator('[data-obstacle]').getAttribute('opacity'),kind==='removal'?'0':'1');
   }
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   results.push({name,width,threeScenes:true,playPause:true,keyboard:true,reducedMotion:true,errors});
   await page.close();
  }
  const plain=await browser.newPage({javaScriptEnabled:false});
  await plain.goto(url);
  assert.equal(await plain.locator('.concept-scene').count(),3);
  assert.equal(await plain.locator('.scene-controls').first().isVisible(),false);
  await plain.close();
 }finally{await browser.close();}
}
await fs.writeFile(out+'/concept-scenes-qa.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
