import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const out='/home/boon/state/primer-motion-20260907/loops';
await fs.mkdir(out,{recursive:true});
const results=[];
for(const [engine,type] of Object.entries({chromium,webkit})) {
 const browser=await type.launch();
 try {
  for(const width of [375,1280]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install();
   await page.goto(new URL('../deploy-site/primer.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
   const draft=page.locator('[data-draft-animation]');
   await draft.scrollIntoViewIfNeeded();
   await page.getByRole('button',{name:'Play animation',exact:true}).click();
   await page.evaluate(()=>{
    window.packChecks={frames:0,collisions:[]};
    function check(){
     const boxes=[...document.querySelectorAll('[data-pack]')].filter(p=>p.style.display!=='none').map(p=>({id:p.dataset.pack,b:p.getBoundingClientRect()}));
     for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i].b,b=boxes[j].b;
      if(a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top)
       window.packChecks.collisions.push({a:boxes[i].id,b:boxes[j].id,time:document.querySelector('[data-draft-animation]').dataset.time});
     }
     window.packChecks.frames++;requestAnimationFrame(check);
    }requestAnimationFrame(check);
   });
   await page.clock.runFor(20000);
   assert.ok(Number(await draft.getAttribute('data-cycles'))>=2,'two automatic loops');
   const checks=await page.evaluate(()=>window.packChecks);
   assert.equal(checks.collisions.length,0,JSON.stringify(checks.collisions.slice(0,3)));
   await page.getByRole('button',{name:'Pause animation',exact:true}).click();
   const paused=await draft.getAttribute('data-time');
   await page.clock.runFor(500);
   assert.equal(await draft.getAttribute('data-time'),paused);
   assert.equal(await draft.locator('[data-face]').count(),0);
   assert.equal(await draft.locator('[data-body] > *').count(),8,'only a torso and circle per person');
   await draft.screenshot({path:out+'/'+engine+'-'+width+'-draft.png'});
   const scenes=await page.locator('[data-concept]').all();
   assert.equal(scenes.length,3);
   for(const scene of scenes){
    await scene.scrollIntoViewIfNeeded();
    await scene.locator('[data-play]').click();
    await page.clock.runFor(5600);
    assert.ok(Number(await scene.getAttribute('data-progress'))<.4,'concept restarts after end hold');
    assert.match(await scene.locator('[data-play]').getAttribute('aria-label'),/^Pause/);
   }
   await page.goto(new URL('../deploy-site/motion-studies.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
   await page.getByRole('button',{name:'Play study',exact:true}).click();
   await page.clock.runFor(7600);
   assert.ok(Number(await page.locator('.stage').getAttribute('data-progress'))<.3,'study loops');
   assert.ok(await page.getByRole('button',{name:'Pause study',exact:true}).isVisible());
   assert.deepEqual(errors,[]);
   results.push({engine,width,frames:checks.frames,collisions:0,cycles:2,conceptLoops:true,studyLoop:true});
   await page.close();
  }
 } finally {await browser.close();}
}
await fs.writeFile(out+'/browser.json',JSON.stringify(results,null,2));
console.log(results);
