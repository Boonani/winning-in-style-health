import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {conceptSceneCSS,conceptSceneMarkup} from './primer-concept-scenes.mjs';
const output='/home/boon/state/primer-motion-20260907',results=[];
for(const [name,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{
  for(const javaScriptEnabled of [true,false]){
   const page=await browser.newPage({viewport:{width:320,height:900},javaScriptEnabled,reducedMotion:'reduce'});
   const scene=conceptSceneMarkup('plan-lesson',{heading:'Owner-edited labels',body:['W'.repeat(80),'These are words that wrap inside a narrow phone diagram instead of overlapping.','M'.repeat(80)]});
   await page.setContent('<!doctype html><style>body{margin:20px;background:#090C12;color:white}'+conceptSceneCSS+'</style>'+scene);
   const bounds=await page.locator('foreignObject').evaluateAll(nodes=>nodes.map(node=>{
    const child=node.firstElementChild,rect=node.getBoundingClientRect();
    return {contentHeight:child.scrollHeight,availableHeight:Number(node.getAttribute('height')),
     contentWidth:child.scrollWidth,availableWidth:Number(node.getAttribute('width')),x:rect.x,right:rect.right};
   }));
   assert.equal(bounds.length,3);
   for(const b of bounds){
    assert.ok(b.contentHeight<=b.availableHeight,JSON.stringify(b));
    assert.ok(b.contentWidth<=b.availableWidth,JSON.stringify(b));
    assert.ok(b.x>=0&&b.right<=320,JSON.stringify(b));
   }
   await page.screenshot({path:output+'/'+name+'-long-labels-'+javaScriptEnabled+'.png'});
   results.push({name,javaScriptEnabled,labelsFit:true,bounds});
   await page.close();
  }
 }finally{await browser.close();}
}
await fs.writeFile(output+'/long-labels-qa.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
