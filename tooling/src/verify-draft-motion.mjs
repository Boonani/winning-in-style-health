import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium, webkit} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.MOTION_QA_DIR || '/home/boon/state/primer-motion-20260907';
await fs.mkdir(output,{recursive:true});
const results=[];
for(const [engine,type] of Object.entries({chromium,webkit})) {
  const browser=await type.launch({headless:true});
  try {
    for(const width of [375,1280]) {
      const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===375});
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('file://'+path.join(root,'deploy-site/primer.html'));
      const animation=page.locator('[data-draft-animation]');
      await animation.scrollIntoViewIfNeeded();
      await page.getByRole('button',{name:'Play animation',exact:true}).click();
      await page.waitForFunction(()=>Number(document.querySelector('[data-draft-animation]').dataset.time)>2 && document.querySelector('[data-pack][data-status="queued"]'));
      await page.getByRole('button',{name:'Pause animation',exact:true}).click();
      const paused=await animation.getAttribute('data-time');
      await page.waitForTimeout(250);
      assert.equal(await animation.getAttribute('data-time'),paused);
      assert.ok(await page.locator('[data-pack][data-status="queued"]').count()>0,'A real waiting pack should appear');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await animation.screenshot({path:path.join(output,engine+'-'+width+'.png')});
      await page.getByRole('button',{name:'Restart animation'}).click();
      assert.equal(await animation.getAttribute('data-time'),'0.000');
      await page.getByRole('button',{name:'Next pick',exact:true}).focus();
      await page.keyboard.press('Enter');
      assert.ok(Number(await animation.getAttribute('data-time'))>0,'Keyboard step advances');
      assert.deepEqual(errors,[]);
      results.push({engine,width,playPause:true,queue:true,restart:true,keyboard:true,overflow:false,errors});
      await context.close();
    }
    for(const javaScriptEnabled of [true,false]) {
      const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce',javaScriptEnabled});
      const page=await context.newPage();
      await page.goto('file://'+path.join(root,'deploy-site/primer.html'));
      const animation=page.locator('[data-draft-animation]');
      await animation.scrollIntoViewIfNeeded();
      assert.match(await animation.textContent(),/Pick 1 card, pass the pack to the left/);
      if(javaScriptEnabled) {
        assert.equal(await animation.getAttribute('data-time'),'0.000');
        await page.getByRole('button',{name:'Next pick',exact:true}).click();
        assert.ok(Number(await animation.getAttribute('data-time'))>0);
        assert.equal(await page.locator('[data-picked-card]').first().getAttribute('opacity'),'0');
      } else {
        assert.ok(await animation.locator('noscript').isVisible());
        assert.equal(await page.locator('.motion-controls').isVisible(),false);
      }
      results.push({engine,javaScriptEnabled,reducedMotion:true,reading:true});
      await context.close();
    }
  } finally {await browser.close();}
}
await fs.writeFile(path.join(output,'motion-qa.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
