import test from 'node:test';
import assert from 'node:assert/strict';
import {CONCEPTS,conceptPose,conceptSceneMarkup} from './primer-concept-scenes.mjs';
test('concept illustrations have deterministic poses and retain volume',()=>{
 for(const kind of Object.keys(CONCEPTS)){
  assert.deepEqual(conceptPose(kind,0),conceptPose(kind,-1));
  assert.equal(conceptPose(kind,4).u,1);
  assert.equal(conceptPose(kind,4).x,505);
  for(let t=0;t<=4;t+=.05){
   const p=conceptPose(kind,t);
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.scale>0);
   assert.ok(Math.abs(p.scale*(1/p.scale)-1)<1e-12);
  }
 }
 assert.equal(conceptPose('removal',4).answered,1);
 assert.equal(conceptPose('finish',4).answered,0,'Flying does not destroy the blocker');
 assert.equal(conceptPose('plan-lesson',4).focus,2);
 assert.throws(()=>conceptPose('unknown',1));
 assert.throws(()=>conceptPose('finish',NaN));
 assert.throws(()=>conceptPose('finish',Infinity));
});
test('editable scene copy is escaped in SVG and inline configuration',()=>{
 const html=conceptSceneMarkup('finish',{heading:'Oscar <test>',body:['</script><script>alert(1)</script>','Blocker','Done']});
 assert.equal((html.match(/<script>/g)||[]).length,1);
 assert.ok(html.includes('Oscar &lt;test&gt;'));
 assert.ok(html.includes('&lt;/script&gt;'));
});
test('every scene has native static reading and local controls',()=>{
 for(const kind of Object.keys(CONCEPTS)){
  const html=conceptSceneMarkup(kind);
  assert.ok(html.includes('role="img"'));
  assert.ok(html.includes('data-restart'));
  assert.ok(!html.includes('<video'));
  assert.equal((html.match(/<script>/g)||[]).length,1);
 }
});
