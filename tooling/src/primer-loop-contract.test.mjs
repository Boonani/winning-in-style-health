import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {draftAnimationMarkup} from './primer-draft-animation.mjs';
test('people are just circles and torsos, with no faces or arms',()=>{
 const html=draftAnimationMarkup();
 assert.doesNotMatch(html,/data-face|M-23 9 Q-35/);
 assert.equal((html.match(/<g data-body>/g)||[]).length,4);
 assert.match(html,/#FF94AC/);
 assert.doesNotMatch(html,/#FE0040/);
});
test('rose retains strong contrast on table and for dark card labels',()=>{
 const luminance=hex=>{
  const c=hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
 };
 for(const dark of ['090C12','12161B'])assert.ok((luminance('FF94AC')+.05)/(luminance(dark)+.05)>7);
});
test('research examples and professional attributions remain editable, optional and qualified',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../data/primer-content.json',import.meta.url)));
 const counts=c.sections.find(s=>s.id==='starting-counts');
 assert.match(counts.body.join(' '),/not quotas/);
 assert.match(counts.body.join(' '),/Roles overlap/);
 assert.match(counts.body.join(' '),/not guarantees/);
 const quotes=c.sections.find(s=>s.id==='pro-notes').body.join(' ');
 for(const author of ['LSV','Caleb Durward','Reid Duke'])assert.ok(quotes.includes(author));
 assert.ok(c.sources.some(s=>s.label.includes('Frank Karsten')));
 assert.deepEqual(c.sections.find(s=>s.id==='blink').body,['']);
});
