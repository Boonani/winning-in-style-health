import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DESIGNED_LANES, fitsPair, laneRoles, summarizeLane, buildDesignedModel } from './designed-archetypes.mjs';
import { renderDraftPrimer, renderCubeCobraPrimer, primerCards, orderedPrimerLanes } from './draft-primer.mjs';

const lane=DESIGNED_LANES[0];
const make=(id,colors,roles,type='Creature',cmc=2,board='mainboard')=>({id,name:id,colors,board,type,cmc,oracleText:'',archetypeRoles:roles.map(role=>({archetypeId:'blink',role}))});
test('exact two-color containment includes colorless, rejects third-color cards',()=>{
  assert.equal(fitsPair(make('wu',['W','U'],[]),'WU'),true);
  assert.equal(fitsPair(make('wug',['W','U','G'],[]),'WU'),false);
  assert.equal(fitsPair(make('c',[],[]),'WU'),true);
  assert.equal(fitsPair(make('c',[],[]),'WU',false),false);
});
test('role donut partitions cards, does not double count a both-role card',()=>{
  const cards=[make('e',['W'],['enablers']),make('p',['U'],['payoffs']),make('b',[],['payoffs','enablers','payoffs']),make('x',['R'],['payoffs']),make('side',['W'],['payoffs'],'Creature',2,'maybeboard')];
  const s=summarizeLane(cards,lane);
  assert.deepEqual(s.payoffs,['p','b']);
  assert.deepEqual(s.enablers,['e','b']);
  assert.equal(s.union.length,3);
  assert.equal(s.payoffOnly.length+s.enablerOnly.length+s.both.length,s.union.length);
  assert.deepEqual(summarizeLane(cards,lane,'outside').union,['x']);
  assert.equal(summarizeLane(cards,lane,'outside').colors.R.payoffs,1);
  assert.equal(summarizeLane(cards,lane,'all').union.length,4);
  assert.equal(summarizeLane(cards,lane,'pair',false).union.length,2);
});
test('type donut excludes lands, artifact creatures count as creatures once',()=>{
  const s=summarizeLane([make('ac',['W'],['payoffs'],'Artifact Creature'),make('i',['U'],['enablers'],'Instant'),make('l',[],['enablers'],'Artifact Land',0),make('lc',[],['payoffs'],'Land Creature',0)],lane);
  assert.equal(s.creatures,1);
  assert.equal(s.noncreatures,1);
  assert.equal(s.lands,2);
  assert.equal(s.curve.reduce((a,b)=>a+b,0),2);
});
test('Rakdos does not call every artifact reward a sacrifice payoff',()=>{
  const br=DESIGNED_LANES.find(l=>l.id==='BR');
  const card={...make('generic',['R'],[]),archetypeRoles:[{archetypeId:'artifacts',role:'payoffs'}],oracleText:'Whenever you cast an artifact spell, draw a card.'};
  assert.deepEqual(laneRoles(card,br),[]);
  card.oracleText='Whenever an artifact you control dies, each opponent loses 1 life.';
  assert.deepEqual(laneRoles(card,br),['payoffs']);
});
test('empty support stays empty and curve is finite',()=>{
  const s=summarizeLane([],lane);
  assert.equal(s.union.length,0);
  assert.equal(s.pairPool,0);
  assert.deepEqual(s.curve,[0,0,0,0,0,0,0]);
});
const data=JSON.parse(fs.readFileSync(new URL('../outputs/analysis.json',import.meta.url)));
test('ten intended pairs, Blink first, exact symmetric intersections',()=>{
  const m=buildDesignedModel(data);
  assert.equal(m.lanes.length,10);
  assert.equal(new Set(m.lanes.map(l=>l.id)).size,10);
  assert.equal(m.lanes[0].id,'WU');
  m.lanes.forEach((a,i)=>m.lanes.forEach((b,j)=>{
    assert.deepEqual([...m.overlap[i][j]].sort(),[...m.overlap[j][i]].sort());
    for(const id of m.overlap[i][j]){assert.ok(a.pair.union.includes(id));assert.ok(b.pair.union.includes(id));}
    if(i===j)assert.equal(m.overlap[i][j].length,a.pair.union.length);
  }));
});
test('Gruul core counts cannot be inflated by outside colors or high-cost bodies',()=>{
  const rg=buildDesignedModel(data).lanes.find(l=>l.id==='RG');
  for(const id of rg.pair.enablers){const c=data.cards.find(c=>c.id===id);assert.ok(c.cmc<=3);assert.ok(fitsPair(c,'RG'));}
  const injected={...make('outside',['U'],[]),archetypeRoles:[{archetypeId:'power-four',role:'enablers'}]};
  assert.deepEqual(summarizeLane([...data.cards,injected],rg).enablers,rg.pair.enablers);
});
test('primer examples exist in current mainboard and their intended pair',()=>{
  for(const l of orderedPrimerLanes(data)){
    for(const c of primerCards(data,l)){assert.equal(c.board,'mainboard');assert.ok(l.pair.union.includes(c.id));}
  }
  const md=renderCubeCobraPrimer(data);
  assert.ok(!/\[\[(?!!)/.test(md),'Bare card links in primer');
  assert.ok(!/Mono Color|Mono-color|### \{[WUBRG]\} /.test(md));
  assert.equal((md.match(/^### /gm)||[]).length,10);
  assert.ok((md.match(/\[\[!/g)||[]).length>=20);
  const html=renderDraftPrimer(data);
  assert.match(html,/17 lands/);
  assert.match(html,/15 creatures/);
  assert.match(html,/8 other spells/);
  assert.match(html,/Removal is inside the spell slots/);
  assert.match(html,/No commanders required/);
  assert.ok(!html.includes('undefined'));
});
