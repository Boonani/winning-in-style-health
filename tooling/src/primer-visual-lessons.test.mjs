import test from 'node:test';
import assert from 'node:assert/strict';
import {MANA_EXAMPLES,manaExample,deckComposition,manaLessonMarkup,deckLessonMarkup} from './primer-visual-lessons.mjs';

test('one card counts once per color and separates lands from cast-dependent mana',()=>{
 assert.deepEqual(manaExample(0).landSources,['G']);
 assert.deepEqual(manaExample(1).landSources,['G','U']);
 assert.equal(manaExample(1).cardCount,1);
 assert.deepEqual(manaExample(2).landSources,['G']);
 assert.deepEqual(manaExample(2,true).landSources,['G','U']);
 assert.deepEqual(manaExample(2,true).fetchTargets,['Forest','Breeding Pool']);
 assert.deepEqual(manaExample(3).landSources,[]);
 assert.deepEqual(manaExample(3).castDependent,['G']);
 assert.throws(()=>manaExample(9));
});

test('teaching calculations cannot mutate card evidence or the next result',()=>{
 const before=JSON.stringify(MANA_EXAMPLES);
 const state=manaExample(1);state.landSources.push('R');
 assert.deepEqual(manaExample(1).landSources,['G','U']);
 assert.equal(JSON.stringify(MANA_EXAMPLES),before);
});

test('deck balance conserves 40 cards across the full illustration range',()=>{
 for(let lands=14;lands<=20;lands++){
  const state=deckComposition(lands);
  assert.equal(state.lands+state.nonlands,40);
  assert.equal(state.landPercent,lands*2.5);
 }
 assert.deepEqual(deckComposition(),{lands:17,nonlands:23,total:40,landPercent:42.5});
 for(const bad of [13,21,17.5,NaN,'17'])assert.throws(()=>deckComposition(bad));
});

test('editable lesson text cannot terminate inline scripts or inject HTML',()=>{
 const section={heading:'<img src=x onerror=alert(1)>',body:Array(4).fill('</script><script>alert(1)</script>')};
 for(const html of [manaLessonMarkup(section),deckLessonMarkup(section)]){
  assert.equal((html.match(/<script>/g)||[]).length,1);
  assert.ok(!html.includes('<script>alert(1)'));
 }
 assert.ok(manaLessonMarkup(section).includes('&lt;img'));
});
