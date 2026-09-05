import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'../..');
const target=process.env.DESIGN_URL||pathToFileURL(path.join(root,'index.html')).href;
const out=process.env.DESIGN_ARTIFACTS||'/home/boon/state/cube-design-hierarchy-20260905';
await fs.mkdir(out,{recursive:true});
const report=[];
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
 for(const viewport of [{width:1440,height:1000},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-lane="WU"] .design-pie');
  assert.equal(await page.locator('.design-lane').count(),10);
  assert.equal(await page.locator('.design-lane').first().getAttribute('data-lane'),'WU');
  assert.equal(await page.locator('.legacy-overview').getAttribute('open'),null);
  const checkGeometry=async label=>{
   const geometry=await page.evaluate(()=>{
    const overflow=document.documentElement.scrollWidth>innerWidth+1;
    const bad=[...document.querySelectorAll('#design-workspace summary,#design-workspace p,#design-workspace select,#design-workspace .design-title,#design-workspace .design-pair-count')].filter(el=>{
     if(!el.getClientRects().length)return false;
     const r=el.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1||el.scrollWidth>el.clientWidth+2);
    }).map(el=>el.outerHTML.slice(0,160));
    return {overflow,bad};
   });
   assert.equal(geometry.overflow,false,label+' page overflow');
   assert.deepEqual(geometry.bad,[],label+' text clipping');
  };
  await checkGeometry('initial');
  await page.locator('[data-lane="WU"] .design-card').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const im=document.querySelector('[data-lane="WU"] .design-card img');return im.complete&&im.naturalWidth>0;});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(out,engine+'-'+viewport.width+'-overview.png')});
  const summaryData=await page.evaluate(()=>DATA.designed.lanes.map(l=>({id:l.id,p:l.pair.payoffs.length,e:l.pair.enablers.length,o:l.outside.payoffs.length})));
  for(const lane of summaryData){
   if(lane.id!=='WU')await page.locator('[data-lane="'+lane.id+'"] > summary').click();
   const body=page.locator('[data-lane-body="'+lane.id+'"]');
   assert.equal(await body.locator('.design-pie').count(),2);
   assert.match(await body.locator('.design-roles').first().locator('summary').first().innerText(),new RegExp('Payoffs.*'+lane.p));
   const scope=body.locator('select');
   await scope.selectOption('outside');
   assert.match(await body.locator('.design-roles').first().locator('summary').first().innerText(),new RegExp('Payoffs.*'+lane.o));
   await scope.selectOption('pair');
   await body.locator('input[type="checkbox"]').uncheck();
   assert.equal(await body.locator('input').isChecked(),false);
   await body.locator('input').check();
   await body.locator(':scope > .design-roles').last().locator('summary').first().click();
   await checkGeometry(lane.id);
   await page.locator('[data-lane="'+lane.id+'"] > summary').click();
  }
  await page.locator('[data-cross-a="0"][data-cross-b="8"]').click();
  const actual=await page.locator('#design-bridges [data-design-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.designCard).sort());
  const expected=await page.evaluate(()=>[...DATA.designed.overlap[0][8]].sort());
  assert.deepEqual(actual,expected);
  if(actual.length){
   await page.locator('#design-bridges .design-card').first().click();
   assert.equal(await page.locator('#design-card-dialog').isVisible(),true);
   assert.ok((await page.locator('#design-card-detail').innerText()).length>50);
   await page.locator('#design-card-dialog [aria-label="Close card details"]').click();
   assert.equal(await page.locator('#design-card-dialog').isVisible(),false);
  }
  await page.locator('[data-health-lane="RG"][data-health-role="payoffs"]').click();
  assert.equal(await page.locator('#design-bridges .design-card').count(),summaryData.find(l=>l.id==='RG').p);
  await checkGeometry('drilldown');
  const primer=new URL('draft-primer.html',target).href;
  await page.goto(primer,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.deck i').count(),40);
  assert.equal(await page.locator('.checklist input').count(),5);
  await page.locator('.checklist input').first().check();
  assert.equal(await page.locator('.checklist input').first().isChecked(),true);
  assert.equal(await page.locator('details summary').count(),11);
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'primer page overflow');
  await page.screenshot({path:path.join(out,engine+'-'+viewport.width+'-primer.png')});
  await page.locator('a[href="./?pair=RG"]').evaluate(el=>el.closest('details').open=true);
  await page.locator('a[href="./?pair=RG"]').click();
  await page.waitForSelector('[data-lane="RG"][open]');
  assert.equal(await page.locator('.design-lane[open]').count(),1);
  assert.deepEqual(errors,[]);
  report.push({engine,viewport,passed:true,pairs:10,images:true});
  console.log(JSON.stringify(report.at(-1)));
  await page.close();
 }
 }finally{await browser.close();}
}
await fs.writeFile(path.join(out,'design-browser-results.json'),JSON.stringify(report,null,2));
console.log('DESIGN_VISUAL_OK');
