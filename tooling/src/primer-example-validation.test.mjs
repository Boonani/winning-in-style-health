import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PRIMER_CONTENT} from './draft-primer.mjs';
import {validatePrimerContent} from './primer-content.mjs';

test('every visual example has an editable explanation in the right position',()=>{
 for(const [id,count] of [['mana-example',4],['deck-example',2]]){
  const copy=structuredClone(DEFAULT_PRIMER_CONTENT);
  const section=copy.sections.find(s=>s.id===id);
  assert.equal(section.body.length,count);
  section.body[0]='Oscar can rewrite this.';
  assert.equal(validatePrimerContent(copy).sections.find(s=>s.id===id).body[0],'Oscar can rewrite this.');
  section.body.pop();
  assert.throws(()=>validatePrimerContent(copy),new RegExp(id+'.body'));
 }
});
