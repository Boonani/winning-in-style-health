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
  const designCards=await page.locator('[data-lane="WU"] .design-card').evaluateAll(nodes=>nodes.slice(0,3).map(node=>node.getBoundingClientRect()).map(({top,bottom,width})=>({top,bottom,width})));
  for(let i=1;i<designCards.length;i++)assert.ok(designCards[i].top>=designCards[i-1].bottom-1,'dashboard cards must be one per row');
  if(viewport.width<=980)assert.ok(designCards[0].width>=viewport.width-2,'dashboard phone artwork uses the viewport width');
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
  await page.locator('[data-group="updates"]').click();
  await page.locator('[data-update-period="all"]').click();
  const historyStacks=await page.locator('.change-cards').evaluateAll(groups=>groups.map(group=>[...group.querySelectorAll('.change-card')].map(card=>card.getBoundingClientRect()).map(({top,bottom})=>({top,bottom}))));
  for(const stack of historyStacks)for(let i=1;i<stack.length;i++)assert.ok(stack[i].top>=stack[i-1].bottom-1,'history cards must be one per row');
  const replacements=await page.locator('.replacement').evaluateAll(groups=>groups.map(group=>[...group.querySelectorAll('.change-card')].map(card=>card.getBoundingClientRect()).map(({top,bottom})=>({top,bottom}))));
  for(const stack of replacements)for(let i=1;i<stack.length;i++)assert.ok(stack[i].top>=stack[i-1].bottom-1,'replacement cards must be one per row');
  if(viewport.width<=980&&await page.locator('.change-cards .change-card').count())assert.ok((await page.locator('.change-cards .change-card').first().boundingBox()).width>=viewport.width-2,'history phone artwork uses the viewport width');
  if(viewport.width<=980&&await page.locator('.replacement .change-card').count())assert.ok((await page.locator('.replacement .change-card').first().boundingBox()).width>=viewport.width-2,'replacement phone artwork uses the viewport width');
  const primer=new URL('draft-primer.html',target).href;
  await page.goto(primer,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.deck i').count(),40);
  assert.equal(await page.locator('.checklist input').count(),5);
  await page.locator('.checklist input').first().check();
  assert.equal(await page.locator('.checklist input').first().isChecked(),true);
  assert.equal(await page.locator('details summary').count(),11);
  const removalCards=await page.locator('#removal .primer-card').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect()).map(({top,bottom,width})=>({top,bottom,width})));
  for(let i=1;i<removalCards.length;i++)assert.ok(removalCards[i].top>=removalCards[i-1].bottom-1,'primer cards must be one per row');
  if(viewport.width<=900)assert.ok(removalCards[0].width>=viewport.width-2,'primer phone artwork uses the viewport width');
  assert.equal(await page.locator('#removal .primer-card img').first().evaluate(node=>getComputedStyle(node).objectFit),'contain');
  const rapid=page.locator('.plans details').nth(1).locator('summary');
  await rapid.scrollIntoViewIfNeeded();
  await rapid.focus();
  const scrollBefore=await page.evaluate(()=>scrollY);
  await rapid.evaluate(summary=>{summary.click();summary.click();summary.click();});
  await page.waitForTimeout(440);
  assert.equal(await rapid.evaluate(summary=>summary.parentElement.open),true,'rapid detail toggles settle on the last intent');
  assert.equal(await rapid.evaluate(summary=>document.activeElement===summary),true,'detail toggle preserves summary focus');
  assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scrollBefore)<3,'detail toggle does not jump scroll');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('[data-motion]').first().evaluate(node=>getComputedStyle(node).opacity),'1');
  assert.ok((await page.locator('[data-motion-bar]').first().evaluate(node=>parseFloat(getComputedStyle(node).transitionDuration)))<=.001);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'primer page overflow');
  await page.screenshot({path:path.join(out,engine+'-'+viewport.width+'-primer.png')});
  await page.locator('a[href="./index.html?pair=RG"]').evaluate(el=>el.closest('details').open=true);
  await page.locator('a[href="./index.html?pair=RG"]').click();
  await page.waitForSelector('[data-lane="RG"][open]');
  assert.equal(await page.locator('.design-lane[open]').count(),1);
  assert.deepEqual(errors,[]);
  const noJs=await browser.newPage({viewport,javaScriptEnabled:false});
  await noJs.goto(primer,{waitUntil:'domcontentloaded'});
  assert.equal(await noJs.locator('h1').isVisible(),true,'no-JS primer title remains visible');
  assert.equal(await noJs.locator('#removal .primer-card').first().isVisible(),true,'no-JS primer cards remain visible');
  assert.equal(await noJs.locator('[data-motion]').first().evaluate(node=>getComputedStyle(node).opacity),'1');
  await noJs.close();
  report.push({engine,viewport,passed:true,pairs:10,images:true});
  console.log(JSON.stringify(report.at(-1)));
  await page.close();
 }
 }finally{await browser.close();}
}
await fs.writeFile(path.join(out,'design-browser-results.json'),JSON.stringify(report,null,2));
console.log('DESIGN_VISUAL_OK');
