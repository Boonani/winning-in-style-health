import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftSimulation} from './primer-draft-simulation.mjs';
import {layoutDraftPacks} from './primer-draft-layout.mjs';
const hands=[[250,146],[354,250],[250,354],[146,250]];
test('short loop holds after passing finishes, never with a pack frozen in flight',()=>{
 const sim=createDraftSimulation();sim.advance(6.5);
 assert.ok(sim.state.packs.every(p=>p.status!=='flight'));
 assert.ok(sim.state.players.every(p=>p.picks.length>0));
});
test('full drafts keep every pack silhouette separated without changing state',()=>{
 for(const speeds of [[1.2,3.8,1.7,2.1],[.1,12,.2,.3],[3,3,3,3]]) {
  const sim=createDraftSimulation({speeds});
  for(let frame=0;!sim.state.finished && frame<120000;frame++) {
   sim.advance(1/60);
   const before=JSON.stringify(sim.state);
   for(const reduced of [false,true]) {
    const poses=layoutDraftPacks(sim.state,hands,reduced);
    for(const p of poses) {
     assert.ok(p.x>=103.99&&p.x<=396.01&&p.y>=103.99&&p.y<=396.01);
     for(const q of poses) if(p.id<q.id)
      assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=79.99,JSON.stringify({time:sim.state.time,p,q}));
    }
   }
   assert.equal(JSON.stringify(sim.state),before);
  }
  assert.equal(sim.state.finished,true);
 }
});
