import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftSimulation} from './primer-draft-simulation.mjs';
test('four independently paced players conserve all 60 cards and queue packs in FIFO order', () => {
 const sim = createDraftSimulation(); let queued = false;
 for (let i=0;i<2000&&!sim.state.finished;i++) {
  sim.advance(.1);
  const s=sim.state;
  assert.equal(s.packs.reduce((n,p)=>n+p.remaining,0)+s.players.reduce((n,p)=>n+p.picks.length,0),60);
  const picked=s.players.flatMap(p=>p.picks);assert.equal(new Set(picked).size,picked.length);
  for(const pack of s.packs) {
   const held=s.players.filter(p=>p.held===pack.id);
   const waiting=s.players.flatMap(p=>p.queue).filter(id=>id===pack.id);
   assert.equal(held.length+waiting.length,pack.status==='held'||pack.status==='queued'?1:0);
   if(pack.status==='flight')assert.equal(pack.to,(pack.from+1)%4);
  }
  queued ||= s.players.some(p=>p.queue.length>0&&p.held!==null);
 }
 assert.equal(sim.state.finished,true);assert.equal(queued,true);
 assert.deepEqual(sim.state.players.map(p=>p.picks.length),[15,15,15,15]);
 for(const player of sim.state.players) {
  const arrival=[player.id,...sim.state.events.filter(e=>e.type==='arrive'&&e.player===player.id).map(e=>e.pack)];
  const receive=sim.state.events.filter(e=>e.type==='receive'&&e.player===player.id).map(e=>e.pack);
  assert.deepEqual(receive,arrival);
 }
});
test('simulation is independent of rendering frame rate',()=>{
 const a=createDraftSimulation(),b=createDraftSimulation();
 a.advance(32);for(let i=0;i<320;i++)b.advance(.1);
 assert.deepEqual(a.state.events,b.state.events);
 assert.deepEqual(a.state.players,b.state.players);
});
test('new runs are independent; uneven speeds and tiny packs terminate',()=>{
 const a=createDraftSimulation({cardsPerPack:3,speeds:[.2,9,.3,.4]}),b=createDraftSimulation();
 a.advance(200);
 assert.equal(a.state.finished,true);assert.equal(b.state.time,0);
 assert.equal(a.state.players.reduce((n,p)=>n+p.picks.length,0),12);
 assert.throws(()=>a.advance(-1));
});
